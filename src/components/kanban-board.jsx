import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import cardService from "@/services/cardService";
import commentService from "@/services/commentService";
import workspaceService from "@/services/workspaceService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, Calendar as CalendarIcon, Paperclip, MessageSquare, MoreVertical, AlertCircle, Pencil, Trash2, X, Clock, User, Flag, Send, Tag } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import api from "@/lib/api";

export function KanbanBoard({ board, onUpdate }) {
  const [columns, setColumns] = useState([]);
  const [draggedTask, setDraggedTask] = useState(null);
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [isEditTaskOpen, setIsEditTaskOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isLoadingCards, setIsLoadingCards] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState(null);
  const [editingTask, setEditingTask] = useState(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [startDate, setStartDate] = useState(null);
  const [dueDate, setDueDate] = useState(null);
  const [selectedAssignees, setSelectedAssignees] = useState([]);
  const [selectedLabels, setSelectedLabels] = useState([]);

  // Data for selectors
  const [boardMembers, setBoardMembers] = useState([]);
  const [boardLabels, setBoardLabels] = useState([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isLoadingLabels, setIsLoadingLabels] = useState(false);

  // Comments
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isAddingComment, setIsAddingComment] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [deleteCommentDialogOpen, setDeleteCommentDialogOpen] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState(null);
  const [isDeletingComment, setIsDeletingComment] = useState(false);

  useEffect(() => {
    if (board && board.lists) {
      const transformedColumns = board.lists
        .sort((a, b) => a.orderIdx - b.orderIdx)
        .map((list) => ({
          id: list.id,
          title: list.name,
          orderIdx: list.orderIdx,
          isDone: list.isDone,
          tasks: [],
        }));
      setColumns(transformedColumns);

      // Load cards for each list
      loadCardsForAllLists(transformedColumns);
    }
  }, [board]);

  // Load members and labels when dialog opens
  useEffect(() => {
    if (isAddTaskOpen && board?.id) {
      loadBoardMembers();
      loadBoardLabels();
    }
  }, [isAddTaskOpen, board?.id]);

  const loadBoardMembers = async () => {
    if (!board?.workspaceId) return;
    setIsLoadingMembers(true);
    try {
      const response = await workspaceService.getMembers(board.workspaceId);
      const members = response.data?.members || response.members || [];
      console.log('Loaded workspace members:', members);
      setBoardMembers(members);
    } catch (error) {
      console.error("Error loading workspace members:", error);
      setBoardMembers([]);
    } finally {
      setIsLoadingMembers(false);
    }
  };

  const loadBoardLabels = async () => {
    if (!board?.id) return;
    setIsLoadingLabels(true);
    try {
      const response = await api.get(`/labels?boardId=${board.id}`);
      setBoardLabels(response.data.labels || []);
    } catch (error) {
      console.error("Error loading board labels:", error);
      setBoardLabels([]);
    } finally {
      setIsLoadingLabels(false);
    }
  };

  const loadCardsForAllLists = async (lists) => {
    setIsLoadingCards(true);
    try {
      const cardsPromises = lists.map(list =>
        cardService.getByListId(list.id).catch(err => {
          console.error(`Error loading cards for list ${list.id}:`, err);
          return { items: [] };
        })
      );

      const cardsResults = await Promise.all(cardsPromises);

      const updatedColumns = lists.map((list, index) => {
        const cardsData = cardsResults[index];
        const cards = cardsData.items || [];

        // Transform cards to tasks format
        const tasks = cards.map(card => ({
          id: card.id,
          title: card.title,
          description: card.description,
          priority: card.priority || 'medium',
          deadline: card.dueDate,
          startDate: card.startDate,
          assignee: card.members && card.members.length > 0 ? {
            name: card.members[0].user?.fullName || 'Unknown',
            avatar: card.members[0].user?.avatar
          } : null,
          attachments: 0, // Will be updated later if needed
          comments: 0, // Will be updated later if needed
          labels: card.labels || [],
          orderIdx: card.orderIdx
        }));

        return {
          ...list,
          tasks: tasks.sort((a, b) => a.orderIdx - b.orderIdx)
        };
      });

      setColumns(updatedColumns);
    } catch (error) {
      console.error("Error loading cards:", error);
      toast.error("Không thể tải danh sách cards");
    } finally {
      setIsLoadingCards(false);
    }
  };

  const handleDragStart = (task, columnId) => {
    setDraggedTask({ task, columnId });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = async (targetColumnId) => {
    if (!draggedTask) return;

    const sourceColumnId = draggedTask.columnId;
    const draggedCardId = draggedTask.task.id;

    // Nếu drop vào cùng column, không làm gì
    if (sourceColumnId === targetColumnId) {
      setDraggedTask(null);
      return;
    }

    const sourceColumn = columns.find((col) => col.id === sourceColumnId);
    const targetColumn = columns.find((col) => col.id === targetColumnId);

    if (!sourceColumn || !targetColumn) return;

    try {
      // Optimistically update UI immediately
      const newColumns = columns.map((col) => {
        if (col.id === sourceColumnId) {
          return {
            ...col,
            tasks: col.tasks.filter((t) => t.id !== draggedCardId),
          };
        }
        if (col.id === targetColumnId) {
          // Add card to end of target column
          const newTasks = [...col.tasks, draggedTask.task];
          return {
            ...col,
            tasks: newTasks,
          };
        }
        return col;
      });

      setColumns(newColumns);
      setDraggedTask(null);

      // Calculate new order index (add to end of target list)
      const newOrderIdx = targetColumn.tasks.length;

      // Call API to move card
      await cardService.move(draggedCardId, targetColumnId, newOrderIdx);

      toast.success("Di chuyển công việc thành công!");

      // Reload both lists to ensure data consistency
      await Promise.all([
        reloadCardsForList(sourceColumnId),
        reloadCardsForList(targetColumnId)
      ]);
    } catch (error) {
      console.error("Error moving card:", error);
      toast.error("Không thể di chuyển công việc. Vui lòng thử lại.");

      // Revert on error
      await Promise.all([
        reloadCardsForList(sourceColumnId),
        reloadCardsForList(targetColumnId)
      ]);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "high":
        return "bg-red-500 ring-2 ring-red-500/20";
      case "medium":
        return "bg-orange-500 ring-2 ring-orange-500/20";
      case "low":
        return "bg-green-500 ring-2 ring-green-500/20";
      default:
        return "bg-gray-500 ring-2 ring-gray-500/20";
    }
  };

  const openAddTask = (columnId) => {
    setSelectedColumn(columnId);
    setIsAddTaskOpen(true);
  };

  const handleCreateTask = async () => {
    if (!title.trim()) {
      toast.error("Vui lòng nhập tiêu đề card");
      return;
    }

    if (!selectedColumn) {
      toast.error("Vui lòng chọn list");
      return;
    }

    try {
      setIsCreating(true);

      const cardData = {
        boardId: board.id,
        listId: selectedColumn,
        title: title.trim(),
        priority,
      };

      // Add optional fields only if they have values
      if (description && description.trim()) {
        cardData.description = description.trim();
      }

      if (startDate) {
        cardData.startDate = startDate.toISOString();
      }

      if (dueDate) {
        cardData.dueDate = dueDate.toISOString();
      }

      if (selectedAssignees.length > 0) {
        cardData.assigneeIds = selectedAssignees;
      }

      if (selectedLabels.length > 0) {
        cardData.labelIds = selectedLabels;
      }

      // Create card and get the response
      const response = await cardService.create(cardData);
      const newCard = response.card || response;

      // Transform the card data from backend format to UI format
      const optimisticTask = {
        id: newCard.id,
        title: newCard.title,
        description: newCard.description || null,
        priority: newCard.priority || 'medium',
        deadline: newCard.dueDate || null,
        startDate: newCard.startDate || null,
        assignee: null, // Will be populated if members exist
        attachments: newCard.attachments?.length || 0,
        comments: 0,
        labels: newCard.labels || [],
        members: newCard.members || [],
        orderIdx: newCard.orderIdx || 0,
        key: newCard.key || null // Human-readable key like "PROJ-123"
      };

      // If there are members assigned, use the first one as assignee for display
      if (newCard.members && newCard.members.length > 0) {
        const firstMember = newCard.members[0];
        if (firstMember.user) {
          optimisticTask.assignee = {
            name: firstMember.user.fullName,
            avatar: null // Can be added later if user has avatar
          };
        }
      }

      setColumns(prevColumns =>
        prevColumns.map(col =>
          col.id === selectedColumn
            ? { ...col, tasks: [...col.tasks, optimisticTask].sort((a, b) => a.orderIdx - b.orderIdx) }
            : col
        )
      );

      toast.success("Tạo card thành công!");

      // Reset form
      setTitle("");
      setDescription("");
      setPriority("medium");
      setStartDate(null);
      setDueDate(null);
      setSelectedAssignees([]);
      setSelectedLabels([]);
      setIsAddTaskOpen(false);

      // Reload in background to ensure data consistency
      reloadCardsForList(selectedColumn);
    } catch (error) {
      console.error("Error creating card:", error);
      toast.error(error.message || "Không thể tạo card. Vui lòng thử lại.");
    } finally {
      setIsCreating(false);
    }
  };

  const reloadCardsForList = async (listId) => {
    try {
      const cardsData = await cardService.getByListId(listId);
      const cards = cardsData.items || [];

      const tasks = cards.map(card => ({
        id: card.id,
        title: card.title,
        description: card.description,
        priority: card.priority || 'medium',
        deadline: card.dueDate,
        startDate: card.startDate,
        assignee: card.members && card.members.length > 0 ? {
          name: card.members[0].user?.fullName || 'Unknown',
          avatar: card.members[0].user?.avatar
        } : null,
        attachments: 0,
        comments: 0,
        labels: card.labels || [],
        orderIdx: card.orderIdx
      }));

      setColumns(prevColumns =>
        prevColumns.map(col =>
          col.id === listId
            ? { ...col, tasks: tasks.sort((a, b) => a.orderIdx - b.orderIdx) }
            : col
        )
      );
    } catch (error) {
      console.error("Error reloading cards:", error);
    }
  };

  const handleCloseDialog = () => {
    setIsAddTaskOpen(false);
    setTitle("");
    setDescription("");
    setPriority("medium");
    setStartDate(null);
    setDueDate(null);
    setSelectedAssignees([]);
    setSelectedLabels([]);
  };

  const openEditTask = async (task, columnId) => {
    setSelectedColumn(columnId);
    setTitle(task.title);
    setDescription(task.description || "");
    setPriority(task.priority || "medium");

    // Load full card data to get dates and assignments
    try {
      const response = await cardService.getById(task.id);
      const fullCard = response.card || response;

      // Store the full card data for comparison
      setEditingTask(fullCard);

      // Set dates
      setStartDate(fullCard.startDate ? new Date(fullCard.startDate) : null);
      setDueDate(fullCard.dueDate ? new Date(fullCard.dueDate) : null);

      // Set assignees
      const assigneeIds = fullCard.members?.map(m => m.userId) || [];
      setSelectedAssignees(assigneeIds);

      // Set labels
      const labelIds = fullCard.labels?.map(l => l.labelId) || [];
      setSelectedLabels(labelIds);

    } catch (error) {
      console.error("Error loading card details for edit:", error);
      // Fallback to task data if API fails
      setEditingTask(task);
    }

    // Load members and labels for selectors
    if (board?.workspaceId) {
      loadBoardMembers();
      loadBoardLabels();
    }

    setIsEditTaskOpen(true);
  };

  const handleUpdateTask = async () => {
    if (!title.trim()) {
      toast.error("Vui lòng nhập tiêu đề card");
      return;
    }

    if (!editingTask) {
      toast.error("Không tìm thấy card cần chỉnh sửa");
      return;
    }

    try {
      setIsUpdating(true);

      const updateData = {
        title: title.trim(),
        priority,
      };

      // Only include description if it has a value
      if (description && description.trim()) {
        updateData.description = description.trim();
      } else {
        // Send empty string to clear description
        updateData.description = "";
      }

      // Add dates
      if (startDate) {
        updateData.startDate = startDate.toISOString();
      }

      if (dueDate) {
        updateData.dueDate = dueDate.toISOString();
      }

      // Update card on server
      await cardService.update(editingTask.id, updateData);

      // Update assignees if changed
      if (editingTask.members) {
        const currentMemberIds = editingTask.members.map(m => m.userId);

        // Find members to add (in selectedAssignees but not in currentMemberIds)
        const toAdd = selectedAssignees.filter(id => !currentMemberIds.includes(id));

        // Find members to remove (in currentMemberIds but not in selectedAssignees)
        const toRemove = currentMemberIds.filter(id => !selectedAssignees.includes(id));

        // Add new members
        for (const userId of toAdd) {
          try {
            await cardService.assignMember(editingTask.id, userId);
          } catch (err) {
            console.error(`Failed to assign member ${userId}:`, err);
          }
        }

        // Remove members
        for (const userId of toRemove) {
          try {
            await cardService.removeMember(editingTask.id, userId);
          } catch (err) {
            console.error(`Failed to remove member ${userId}:`, err);
          }
        }
      }

      // TODO: Update labels if changed (requires label API endpoints)
      if (selectedLabels.length > 0) {
        // Note: This requires separate API calls for labels
        // For now, we'll just update the card and reload
      }

      toast.success("Cập nhật card thành công!");

      // Reset form
      setTitle("");
      setDescription("");
      setPriority("medium");
      setStartDate(null);
      setDueDate(null);
      setSelectedAssignees([]);
      setSelectedLabels([]);
      setIsEditTaskOpen(false);
      setEditingTask(null);

      // Reload to ensure data consistency
      reloadCardsForList(selectedColumn);
    } catch (error) {
      console.error("Error updating card:", error);
      toast.error(error.response?.data?.error || "Không thể cập nhật card. Vui lòng thử lại.");
      // Revert the optimistic update on error
      reloadCardsForList(selectedColumn);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCloseEditDialog = () => {
    setIsEditTaskOpen(false);
    setEditingTask(null);
    setTitle("");
    setDescription("");
    setPriority("medium");
    setStartDate(null);
    setDueDate(null);
    setSelectedAssignees([]);
    setSelectedLabels([]);
  };

  const confirmDeleteTask = (task, columnId) => {
    setTaskToDelete({ task, columnId });
    setDeleteDialogOpen(true);
  };

  const handleDeleteTask = async () => {
    if (!taskToDelete) return;

    try {
      setIsDeleting(true);

      const { task, columnId } = taskToDelete;

      // Optimistically remove the card from the UI immediately
      setColumns(prevColumns =>
        prevColumns.map(col =>
          col.id === columnId
            ? { ...col, tasks: col.tasks.filter(t => t.id !== task.id) }
            : col
        )
      );

      // Close dialog immediately for better UX
      setDeleteDialogOpen(false);

      // Delete card on server
      await cardService.delete(task.id);

      toast.success("Xóa card thành công!");

      setTaskToDelete(null);

      // Reload in background to ensure data consistency
      reloadCardsForList(columnId);
    } catch (error) {
      console.error("Error deleting card:", error);
      toast.error(error.message || "Không thể xóa card. Vui lòng thử lại.");
      // Revert the optimistic update on error
      if (taskToDelete) {
        reloadCardsForList(taskToDelete.columnId);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setTaskToDelete(null);
  };

  const openCardDetail = async (cardId) => {
    try {
      setIsLoadingDetail(true);
      setIsDetailOpen(true);

      const response = await cardService.getById(cardId);
      setSelectedCard(response.card || response);

      // Load comments for this card
      loadComments(cardId);
    } catch (error) {
      console.error("Error loading card detail:", error);
      toast.error("Không thể tải thông tin card");
      setIsDetailOpen(false);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const loadComments = async (cardId) => {
    try {
      setIsLoadingComments(true);
      const response = await commentService.getByCardId(cardId);
      setComments(response.comments || []);
    } catch (error) {
      console.error("Error loading comments:", error);
    } finally {
      setIsLoadingComments(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) {
      toast.error("Vui lòng nhập nội dung comment");
      return;
    }

    if (!selectedCard) return;

    try {
      setIsAddingComment(true);
      const response = await commentService.create(selectedCard.id, {
        bodyMd: newComment.trim()
      });

      // Add new comment to list
      setComments(prev => [...prev, response.comment]);
      setNewComment("");
      toast.success("Đã thêm comment");
    } catch (error) {
      console.error("Error adding comment:", error);
      toast.error("Không thể thêm comment");
    } finally {
      setIsAddingComment(false);
    }
  };

  const handleEditComment = (comment) => {
    setEditingCommentId(comment.id);
    setEditingCommentText(comment.bodyMd);
  };

  const handleUpdateComment = async (commentId) => {
    if (!editingCommentText.trim()) {
      toast.error("Vui lòng nhập nội dung comment");
      return;
    }

    try {
      const response = await commentService.update(commentId, {
        bodyMd: editingCommentText.trim()
      });

      // Update comment in list
      setComments(prev => prev.map(c =>
        c.id === commentId ? { ...c, bodyMd: response.comment.bodyMd } : c
      ));

      setEditingCommentId(null);
      setEditingCommentText("");
      toast.success("Đã cập nhật comment");
    } catch (error) {
      console.error("Error updating comment:", error);
      toast.error("Không thể cập nhật comment");
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!commentToDelete) return;

    try {
      setIsDeletingComment(true);
      await commentService.delete(commentToDelete.id);

      // Remove comment from list
      setComments(prev => prev.filter(c => c.id !== commentToDelete.id));

      setDeleteCommentDialogOpen(false);
      setCommentToDelete(null);
      toast.success("Đã xóa comment");
    } catch (error) {
      console.error("Error deleting comment:", error);
      toast.error("Không thể xóa comment");
    } finally {
      setIsDeletingComment(false);
    }
  };

  const confirmDeleteComment = (comment) => {
    setCommentToDelete(comment);
    setDeleteCommentDialogOpen(true);
  };

  const handleCancelDeleteComment = () => {
    setDeleteCommentDialogOpen(false);
    setCommentToDelete(null);
  };

  const handleCloseDetail = () => {
    setIsDetailOpen(false);
    setSelectedCard(null);
    setComments([]);
    setNewComment("");
    setEditingCommentId(null);
    setEditingCommentText("");
    setDeleteCommentDialogOpen(false);
    setCommentToDelete(null);
  };

  if (!board || columns.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Chưa có danh sách nào</h3>
          <p className="text-muted-foreground text-center mb-6">
            Board này chưa có danh sách công việc
          </p>
        </CardContent>
      </Card>
    );
  }

  const getColumnBorderColor = (columnTitle) => {
    const title = columnTitle.toLowerCase();
    if (title === 'todo') return 'border-cyan-100';
    if (title === 'in progress') return 'border-red-100';
    if (title === 'done') return 'border-green-100';
    return 'border-border';
  };

  return (
    <div className="flex gap-6 overflow-x-auto pb-6 px-2">
      {columns.map((column) => (
        <div
          key={column.id}
          className={`flex-shrink-0 w-80 transition-all ${draggedTask && draggedTask.columnId !== column.id
            ? 'ring-2 ring-primary/50 ring-offset-2 rounded-lg'
            : ''
            }`}
          onDragOver={handleDragOver}
          onDrop={() => handleDrop(column.id)}
        >
          <Card className={`h-full bg-muted/30 border-2 shadow-sm hover:shadow-md transition-shadow ${getColumnBorderColor(column.title)}`}>
            <CardHeader className="pb-4 bg-background/50 backdrop-blur-sm rounded-t-lg border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-bold tracking-tight">{column.title}</CardTitle>
                  <Badge variant="secondary" className="rounded-full h-6 w-6 flex items-center justify-center p-0 font-semibold bg-primary/10 text-primary border border-primary/20">
                    {column.tasks?.length || 0}
                  </Badge>
                  {column.isDone && (
                    <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/20">
                      Done
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openAddTask(column.id)}
                  className="hover:bg-primary/10 hover:text-primary transition-colors"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-4 min-h-[200px]">
              {isLoadingCards ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <p className="text-sm">Đang tải công việc</p>
                </div>
              ) : (!column.tasks || column.tasks.length === 0) ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  {draggedTask && draggedTask.columnId !== column.id ? (
                    <div className="text-center">
                      <div className="h-12 w-12 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
                        <Plus className="h-6 w-6 text-primary" />
                      </div>
                      <p className="text-sm font-medium text-primary">Thả card vào đây</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm">Chưa có task nào</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openAddTask(column.id)}
                        className="mt-2"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Thêm task
                      </Button>
                    </>
                  )}
                </div>
              ) : (
                column.tasks.map((task) => (
                  <Card
                    key={task.id}
                    className={`cursor-move hover:shadow-lg hover:scale-[1.02] hover:border-primary/50 transition-all duration-200 bg-background group ${draggedTask?.task?.id === task.id ? 'opacity-50 scale-95' : ''
                      }`}
                    draggable
                    onDragStart={() => handleDragStart(task, column.id)}
                    onDragEnd={() => setDraggedTask(null)}
                    onClick={() => openCardDetail(task.id)}
                  >
                    <CardContent className="p-3 space-y-2.5">
                      {/* Header: Title and Menu */}
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-semibold text-sm leading-snug flex-1 group-hover:text-primary transition-colors">
                          {task.title}
                        </h4>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 -mt-1 -mr-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/10"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditTask(task, column.id); }}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Chỉnh sửa
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={(e) => { e.stopPropagation(); confirmDeleteTask(task, column.id); }}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Xóa
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Description */}
                      {task.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {task.description}
                        </p>
                      )}

                      {/* Footer: Due date and Assignee */}
                      <div className="flex items-center justify-between pt-1.5">
                        {/* Due Date */}
                        {task.deadline ? (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <CalendarIcon className="h-3 w-3" />
                            <span className="font-medium">
                              {new Date(task.deadline).toLocaleDateString("vi-VN", {
                                day: '2-digit',
                                month: '2-digit'
                              })}
                            </span>
                          </div>
                        ) : (
                          <span />
                        )}

                        {/* Assignee Avatar */}
                        {task.assignee && (
                          <Avatar className="h-6 w-6 border-2 border-background ring-1 ring-primary/20">
                            <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                              {task.assignee.name?.charAt(0) || 'U'}
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      ))}

      {/* Add Task Dialog */}
      <Dialog open={isAddTaskOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Tạo card mới</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Thêm công việc mới vào list {columns.find(col => col.id === selectedColumn)?.title}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[calc(90vh-140px)] pr-4">
            <div className="space-y-5 py-4">
              <div className="space-y-2">
                <Label htmlFor="task-title" className="text-sm font-semibold">
                  Tiêu đề <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="task-title"
                  placeholder="Nhập tiêu đề card..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="border-2 focus:border-primary"
                  disabled={isCreating}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="task-description" className="text-sm font-semibold">Mô tả</Label>
                <Textarea
                  id="task-description"
                  placeholder="Mô tả chi tiết về card..."
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="border-2 focus:border-primary resize-none"
                  disabled={isCreating}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="task-priority" className="text-sm font-semibold">Độ ưu tiên</Label>
                <Select value={priority} onValueChange={setPriority} disabled={isCreating}>
                  <SelectTrigger id="task-priority" className="border-2">
                    <SelectValue placeholder="Chọn độ ưu tiên" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-green-500" />
                        <span>Thấp</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="medium">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-orange-500" />
                        <span>Trung bình</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="high">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-red-500" />
                        <span>Cao</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date Fields */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Ngày bắt đầu</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        disabled={isCreating}
                        className={cn(
                          "w-full justify-start text-left font-normal border-2",
                          !startDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "dd/MM/yyyy") : "Chọn ngày"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Ngày hết hạn</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        disabled={isCreating}
                        className={cn(
                          "w-full justify-start text-left font-normal border-2",
                          !dueDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dueDate ? format(dueDate, "dd/MM/yyyy") : "Chọn ngày"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dueDate}
                        onSelect={setDueDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Assignees Field */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Gán cho thành viên</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      disabled={isCreating || isLoadingMembers}
                      className="w-full justify-start border-2"
                    >
                      <User className="mr-2 h-4 w-4" />
                      {selectedAssignees.length > 0
                        ? `${selectedAssignees.length} thành viên được chọn`
                        : "Chọn thành viên"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-3" align="start">
                    <div className="space-y-2">
                      {isLoadingMembers ? (
                        <div className="text-sm text-muted-foreground text-center py-2">Đang tải...</div>
                      ) : boardMembers.length === 0 ? (
                        <div className="text-sm text-muted-foreground text-center py-2">Chưa có thành viên</div>
                      ) : (
                        boardMembers.map((member) => (
                          <div key={member.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`member-${member.id}`}
                              checked={selectedAssignees.includes(member.userId)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedAssignees([...selectedAssignees, member.userId]);
                                } else {
                                  setSelectedAssignees(selectedAssignees.filter(id => id !== member.userId));
                                }
                              }}
                            />
                            <label
                              htmlFor={`member-${member.id}`}
                              className="flex items-center gap-2 text-sm font-medium cursor-pointer flex-1"
                            >
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={member.user?.avatar} />
                                <AvatarFallback className="text-xs">
                                  {member.user?.fullName?.charAt(0) || 'U'}
                                </AvatarFallback>
                              </Avatar>
                              <span>{member.user?.fullName || 'Unknown'}</span>
                            </label>
                          </div>
                        ))
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Labels Field */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Nhãn</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      disabled={isCreating || isLoadingLabels}
                      className="w-full justify-start border-2"
                    >
                      <Flag className="mr-2 h-4 w-4" />
                      {selectedLabels.length > 0
                        ? `${selectedLabels.length} nhãn được chọn`
                        : "Chọn nhãn"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-3" align="start">
                    <div className="space-y-2">
                      {isLoadingLabels ? (
                        <div className="text-sm text-muted-foreground text-center py-2">Đang tải...</div>
                      ) : boardLabels.length === 0 ? (
                        <div className="text-sm text-muted-foreground text-center py-2">Chưa có nhãn</div>
                      ) : (
                        boardLabels.map((label) => (
                          <div key={label.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`label-${label.id}`}
                              checked={selectedLabels.includes(label.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedLabels([...selectedLabels, label.id]);
                                } else {
                                  setSelectedLabels(selectedLabels.filter(id => id !== label.id));
                                }
                              }}
                            />
                            <label
                              htmlFor={`label-${label.id}`}
                              className="flex items-center gap-2 text-sm font-medium cursor-pointer flex-1"
                            >
                              <div
                                className="h-3 w-3 rounded-full"
                                style={{ backgroundColor: label.color || '#gray' }}
                              />
                              <span>{label.name}</span>
                            </label>
                          </div>
                        ))
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={handleCloseDialog}
                  disabled={isCreating}
                  className="flex-1"
                >
                  Hủy
                </Button>
                <Button
                  onClick={handleCreateTask}
                  disabled={!title.trim() || isCreating}
                  className="flex-1 h-11 font-semibold shadow-md hover:shadow-lg transition-shadow"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {isCreating ? "Đang tạo..." : "Tạo card"}
                </Button>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Edit Task Dialog */}
      <Dialog open={isEditTaskOpen} onOpenChange={handleCloseEditDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Chỉnh sửa card</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Cập nhật thông tin card trong list {columns.find(col => col.id === selectedColumn)?.title}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[calc(90vh-140px)] pr-4">
            <div className="space-y-5 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-task-title" className="text-sm font-semibold">
                  Tiêu đề <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="edit-task-title"
                  placeholder="Nhập tiêu đề card..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="border-2 focus:border-primary"
                  disabled={isUpdating}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-task-description" className="text-sm font-semibold">Mô tả</Label>
                <Textarea
                  id="edit-task-description"
                  placeholder="Mô tả chi tiết về card..."
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="border-2 focus:border-primary resize-none"
                  disabled={isUpdating}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-task-priority" className="text-sm font-semibold">Độ ưu tiên</Label>
                <Select value={priority} onValueChange={setPriority} disabled={isUpdating}>
                  <SelectTrigger id="edit-task-priority" className="border-2">
                    <SelectValue placeholder="Chọn độ ưu tiên" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-green-500" />
                        <span>Thấp</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="medium">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-orange-500" />
                        <span>Trung bình</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="high">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-red-500" />
                        <span>Cao</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date Fields */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Ngày bắt đầu</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        disabled={isUpdating}
                        className={cn(
                          "w-full justify-start text-left font-normal border-2",
                          !startDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "dd/MM/yyyy") : "Chọn ngày"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Ngày hết hạn</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        disabled={isUpdating}
                        className={cn(
                          "w-full justify-start text-left font-normal border-2",
                          !dueDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dueDate ? format(dueDate, "dd/MM/yyyy") : "Chọn ngày"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dueDate}
                        onSelect={setDueDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Assignees Field */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Gán cho thành viên</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      disabled={isUpdating || isLoadingMembers}
                      className="w-full justify-start border-2"
                    >
                      <User className="mr-2 h-4 w-4" />
                      {selectedAssignees.length > 0
                        ? `${selectedAssignees.length} thành viên được chọn`
                        : "Chọn thành viên"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-3" align="start">
                    <div className="space-y-2">
                      {isLoadingMembers ? (
                        <div className="text-sm text-muted-foreground text-center py-2">Đang tải...</div>
                      ) : boardMembers.length === 0 ? (
                        <div className="text-sm text-muted-foreground text-center py-2">Chưa có thành viên</div>
                      ) : (
                        boardMembers.map((member) => (
                          <div key={member.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`edit-member-${member.id}`}
                              checked={selectedAssignees.includes(member.userId)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedAssignees([...selectedAssignees, member.userId]);
                                } else {
                                  setSelectedAssignees(selectedAssignees.filter(id => id !== member.userId));
                                }
                              }}
                            />
                            <label
                              htmlFor={`edit-member-${member.id}`}
                              className="flex items-center gap-2 text-sm font-medium cursor-pointer flex-1"
                            >
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-xs">
                                  {member.user?.fullName?.charAt(0) || 'U'}
                                </AvatarFallback>
                              </Avatar>
                              <span>{member.user?.fullName || 'Unknown'}</span>
                            </label>
                          </div>
                        ))
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Labels Field */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Nhãn</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      disabled={isUpdating || isLoadingLabels}
                      className="w-full justify-start border-2"
                    >
                      <Flag className="mr-2 h-4 w-4" />
                      {selectedLabels.length > 0
                        ? `${selectedLabels.length} nhãn được chọn`
                        : "Chọn nhãn"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-3" align="start">
                    <div className="space-y-2">
                      {isLoadingLabels ? (
                        <div className="text-sm text-muted-foreground text-center py-2">Đang tải...</div>
                      ) : boardLabels.length === 0 ? (
                        <div className="text-sm text-muted-foreground text-center py-2">Chưa có nhãn</div>
                      ) : (
                        boardLabels.map((label) => (
                          <div key={label.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`edit-label-${label.id}`}
                              checked={selectedLabels.includes(label.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedLabels([...selectedLabels, label.id]);
                                } else {
                                  setSelectedLabels(selectedLabels.filter(id => id !== label.id));
                                }
                              }}
                            />
                            <label
                              htmlFor={`edit-label-${label.id}`}
                              className="flex items-center gap-2 text-sm font-medium cursor-pointer flex-1"
                            >
                              <div
                                className="h-3 w-3 rounded-full"
                                style={{ backgroundColor: label.color || '#gray' }}
                              />
                              <span>{label.name}</span>
                            </label>
                          </div>
                        ))
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={handleCloseEditDialog}
                  disabled={isUpdating}
                  className="flex-1"
                >
                  Hủy
                </Button>
                <Button
                  onClick={handleUpdateTask}
                  disabled={!title.trim() || isUpdating}
                  className="flex-1 h-11 font-semibold shadow-md hover:shadow-lg transition-shadow"
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  {isUpdating ? "Đang lưu..." : "Lưu thay đổi"}
                </Button>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa card</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa card "<span className="font-semibold text-foreground">{taskToDelete?.task?.title}</span>"?
              Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDelete} disabled={isDeleting}>
              Hủy
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTask}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Đang xóa..." : "Xóa card"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Comment Confirmation Dialog */}
      <AlertDialog open={deleteCommentDialogOpen} onOpenChange={setDeleteCommentDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa bình luận</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa bình luận này?
              Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDeleteComment} disabled={isDeletingComment}>
              Hủy
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteComment}
              disabled={isDeletingComment}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingComment ? "Đang xóa..." : "Xóa bình luận"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Card Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={handleCloseDetail}>
        <DialogContent className="sm:max-w-[650px]">
          {isLoadingDetail ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center space-y-3">
                <div className="h-12 w-12 mx-auto border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground">Đang tải thông tin card...</p>
              </div>
            </div>
          ) : selectedCard ? (
            <>
              <DialogHeader className="space-y-2 pb-4 border-b">
                <div className="flex items-start gap-3">
                  <div className="flex-1 space-y-2">
                    <DialogTitle className="text-xl font-bold leading-tight">{selectedCard.title}</DialogTitle>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="font-mono text-xs">
                        #{selectedCard.id?.slice(0, 8)}
                      </Badge>
                      {selectedCard.list && (
                        <Badge variant="secondary" className="text-xs">
                          {selectedCard.list.name}
                        </Badge>
                      )}
                      <div className="flex items-center gap-1.5">
                        <div className={`h-2.5 w-2.5 rounded-full ${getPriorityColor(selectedCard.priority)}`} />
                        <span className="text-xs text-muted-foreground capitalize">
                          {selectedCard.priority === 'high' && 'Cao'}
                          {selectedCard.priority === 'medium' && 'Trung bình'}
                          {selectedCard.priority === 'low' && 'Thấp'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <ScrollArea className="max-h-[calc(85vh-180px)]">
                <div className="space-y-5 py-4 pr-4">
                  {/* Description */}
                  {selectedCard.description && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <MessageSquare className="h-4 w-4" />
                        <span>Mô tả</span>
                      </div>
                      <div className="bg-muted/50 rounded-md p-3">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{selectedCard.description}</p>
                      </div>
                    </div>
                  )}

                  {/* Dates */}
                  {(selectedCard.startDate || selectedCard.dueDate) && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <CalendarIcon className="h-4 w-4" />
                        <span>Thời gian</span>
                      </div>
                      <div className="space-y-2">
                        {selectedCard.startDate && (
                          <div className="flex items-center gap-3 text-sm">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground min-w-[90px]">Ngày bắt đầu:</span>
                            <span className="font-medium">
                              {format(new Date(selectedCard.startDate), "dd/MM/yyyy")}
                            </span>
                          </div>
                        )}
                        {selectedCard.dueDate && (
                          <div className="flex items-center gap-3 text-sm">
                            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground min-w-[90px]">Hạn chót:</span>
                            <span className="font-medium">
                              {format(new Date(selectedCard.dueDate), "dd/MM/yyyy")}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Members */}
                  {selectedCard.members && selectedCard.members.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <User className="h-4 w-4" />
                        <span>Thành viên ({selectedCard.members.length})</span>
                      </div>
                      <div className="space-y-2">
                        {selectedCard.members.map((member) => (
                          <div key={member.userId} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors">
                            <Avatar className="h-8 w-8 border">
                              <AvatarImage src={member.user?.avatar} />
                              <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                                {member.user?.fullName?.charAt(0) || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">{member.user?.fullName || 'Unknown User'}</p>
                              <p className="text-xs text-muted-foreground">{member.user?.email}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Labels */}
                  {selectedCard.labels && selectedCard.labels.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <Tag className="h-4 w-4" />
                        <span>Nhãn ({selectedCard.labels.length})</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedCard.labels.map((labelItem) => (
                          <Badge
                            key={labelItem.labelId}
                            variant="secondary"
                            className="px-3 py-1"
                          >
                            {labelItem.label?.name || 'Label'}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Comments Section */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <MessageSquare className="h-4 w-4" />
                      <span>Bình luận ({comments.length})</span>
                    </div>

                    {/* Add Comment */}
                    <div className="space-y-2">
                      <Textarea
                        placeholder="Thêm bình luận..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        className="min-h-[80px] resize-none"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.ctrlKey) {
                            handleAddComment();
                          }
                        }}
                      />
                      <div className="flex justify-between items-center">
                        <p className="text-xs text-muted-foreground">Nhấn Ctrl+Enter để gửi</p>
                        <Button
                          size="sm"
                          onClick={handleAddComment}
                          disabled={isAddingComment || !newComment.trim()}
                        >
                          <Send className="mr-2 h-3.5 w-3.5" />
                          {isAddingComment ? "Đang gửi..." : "Gửi"}
                        </Button>
                      </div>
                    </div>

                    {/* Comments List */}
                    {isLoadingComments ? (
                      <div className="flex justify-center py-4">
                        <div className="h-6 w-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                      </div>
                    ) : comments.length > 0 ? (
                      <div className="space-y-3 max-h-[300px] overflow-y-auto">
                        {comments.map((comment) => (
                          <div key={comment.id} className="bg-muted/30 rounded-lg p-3 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-7 w-7 border">
                                  <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                                    {comment.author?.fullName?.charAt(0) || 'U'}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="text-sm font-medium">{comment.author?.fullName || 'Unknown'}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {format(new Date(comment.createdAt), "dd/MM/yyyy HH:mm")}
                                  </p>
                                </div>
                              </div>

                              {/* Edit/Delete buttons - only show for comment author */}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7">
                                    <MoreVertical className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleEditComment(comment)}>
                                    <Pencil className="mr-2 h-3.5 w-3.5" />
                                    Chỉnh sửa
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => confirmDeleteComment(comment)}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                                    Xóa
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>

                            {/* Comment Content */}
                            {editingCommentId === comment.id ? (
                              <div className="space-y-2">
                                <Textarea
                                  value={editingCommentText}
                                  onChange={(e) => setEditingCommentText(e.target.value)}
                                  className="min-h-[60px] resize-none"
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleUpdateComment(comment.id)}
                                  >
                                    Lưu
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setEditingCommentId(null);
                                      setEditingCommentText("");
                                    }}
                                  >
                                    Hủy
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm leading-relaxed whitespace-pre-wrap pl-9">
                                {comment.bodyMd}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Chưa có bình luận nào
                      </p>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="pt-3 border-t space-y-1 text-xs text-muted-foreground">
                    <p>Tạo lúc: {format(new Date(selectedCard.createdAt), "dd/MM/yyyy HH:mm")}</p>
                    <p>Cập nhật: {format(new Date(selectedCard.updatedAt), "dd/MM/yyyy HH:mm")}</p>
                  </div>
                </div>
              </ScrollArea>

              <div className="flex justify-end gap-2 pt-4 border-t mt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    handleCloseDetail();
                    openEditTask(
                      {
                        id: selectedCard.id,
                        title: selectedCard.title,
                        description: selectedCard.description,
                        priority: selectedCard.priority
                      },
                      selectedCard.listId
                    );
                  }}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Chỉnh sửa
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    handleCloseDetail();
                    confirmDeleteTask(
                      {
                        id: selectedCard.id,
                        title: selectedCard.title
                      },
                      selectedCard.listId
                    );
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Xóa
                </Button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center py-16">
              <p className="text-muted-foreground">Không tìm thấy thông tin card</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
