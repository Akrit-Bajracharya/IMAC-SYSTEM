import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MessageSquare,
  Send,
  Edit2,
  Trash2,
  Check,
  X,
  AlertCircle,
  Eye,
  Loader2,
} from 'lucide-react';
import { Button } from '../ui/button.js';
import { Spinner } from '../layout/Spinner.js';
import {
  fetchTaskComments,
  createTaskComment,
  patchTaskComment,
  deleteTaskComment,
  getProjectErrorInfo,
} from '../../api/projects.js';
import {
  canAddComment,
  canEditComment,
  canDeleteComment,
  isCommentEdited,
} from '../../lib/taskCommentPermissions.js';
import { formatDateDisplay } from '../../lib/dateUtils.js';
import type {
  ProjectRole,
  ProjectMember,
  TaskCommentItem,
} from '../../types/index.js';

interface TaskCommentsSectionProps {
  projectId: string;
  taskId: string;
  commentCount: number;
  callerProjectRole?: ProjectRole;
  isSystemAdmin: boolean;
  currentUserId?: string;
  projectMembers?: ProjectMember[];
  onRefreshTask: () => void;
}

export function TaskCommentsSection({
  projectId,
  taskId,
  commentCount,
  callerProjectRole,
  isSystemAdmin,
  currentUserId,
  projectMembers,
  onRefreshTask,
}: TaskCommentsSectionProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Input states
  const [newCommentText, setNewCommentText] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [commentToDelete, setCommentToDelete] = useState<TaskCommentItem | null>(null);

  // Errors
  const [postError, setPostError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [sectionError, setSectionError] = useState<string | null>(null);

  const canPost = canAddComment(callerProjectRole, isSystemAdmin);
  const isViewer = callerProjectRole === 'viewer' && !isSystemAdmin;

  // Infinite query for comments
  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['taskCommentsInfinite', projectId, taskId],
    queryFn: ({ pageParam }) =>
      fetchTaskComments(projectId, taskId, {
        limit: 20,
        cursor: pageParam ?? undefined,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
    enabled: Boolean(projectId && taskId),
  });

  const comments = useMemo(() => {
    return data?.pages.flatMap((p) => p.items) ?? [];
  }, [data]);

  // Author display name resolution (never raw ID)
  const getAuthorDisplayName = (authorUserId: string, commentAuthorUser?: TaskCommentItem['authorUser']): string => {
    if (commentAuthorUser?.displayName) return commentAuthorUser.displayName;
    if (commentAuthorUser?.username) return commentAuthorUser.username;

    const member = (projectMembers || []).find((m) => m.userId === authorUserId);
    if (member?.user?.displayName) return member.user.displayName;
    if (member?.user?.username) return member.user.username;

    return t('projects.taskDetail.formerMember', 'Former member');
  };

  // Add comment mutation
  const createMutation = useMutation({
    mutationFn: async (body: string) => {
      return createTaskComment(projectId, taskId, body);
    },
    onSuccess: async () => {
      setNewCommentText('');
      setPostError(null);
      await refetch();
      onRefreshTask();
    },
    onError: (err: any) => {
      const errInfo = getProjectErrorInfo(err);
      if (errInfo.status === 403) {
        setPostError(t('projects.taskDetail.comments.errors.forbidden', 'You do not have permission to post comments.'));
        refetch();
        onRefreshTask();
      } else if (errInfo.status === 404) {
        setPostError(t('projects.taskDetail.comments.errors.notFound', 'Task or project not found.'));
        refetch();
        onRefreshTask();
      } else if (errInfo.error === 'validation_error') {
        setPostError(t('projects.taskDetail.comments.errors.validation', 'Comment must be between 1 and 5000 characters.'));
      } else {
        setPostError(errInfo.message || t('projects.taskDetail.comments.errors.generic', 'Failed to post comment.'));
      }
    },
  });

  // Edit comment mutation
  const patchMutation = useMutation({
    mutationFn: async ({ commentId, body }: { commentId: string; body: string }) => {
      return patchTaskComment(projectId, taskId, commentId, body);
    },
    onSuccess: async () => {
      setEditingCommentId(null);
      setEditCommentText('');
      setEditError(null);
      await refetch();
    },
    onError: (err: any) => {
      const errInfo = getProjectErrorInfo(err);
      if (errInfo.status === 403) {
        setEditError(t('projects.taskDetail.comments.errors.editForbidden', 'Only the comment author may edit this comment.'));
        setEditingCommentId(null);
        refetch();
        onRefreshTask();
      } else if (errInfo.status === 404) {
        setEditError(t('projects.taskDetail.comments.errors.notFound', 'Comment or task not found.'));
        setEditingCommentId(null);
        refetch();
        onRefreshTask();
      } else if (errInfo.error === 'validation_error') {
        setEditError(t('projects.taskDetail.comments.errors.validation', 'Comment must be between 1 and 5000 characters.'));
      } else {
        setEditError(errInfo.message || t('projects.taskDetail.comments.errors.generic', 'Failed to edit comment.'));
      }
    },
  });

  // Delete comment mutation
  const deleteMutation = useMutation({
    mutationFn: async (commentId: string) => {
      return deleteTaskComment(projectId, taskId, commentId);
    },
    onSuccess: async () => {
      setCommentToDelete(null);
      setDeleteError(null);
      await refetch();
      onRefreshTask();
    },
    onError: (err: any) => {
      const errInfo = getProjectErrorInfo(err);
      if (errInfo.status === 403) {
        setDeleteError(t('projects.taskDetail.comments.errors.deleteForbidden', 'You do not have permission to delete this comment.'));
        setCommentToDelete(null);
        refetch();
        onRefreshTask();
      } else if (errInfo.status === 404) {
        setDeleteError(t('projects.taskDetail.comments.errors.notFound', 'Comment or task not found.'));
        setCommentToDelete(null);
        refetch();
        onRefreshTask();
      } else {
        setDeleteError(errInfo.message || t('projects.taskDetail.comments.errors.generic', 'Failed to delete comment.'));
      }
    },
  });

  const handlePostSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCommentText.trim();
    if (!trimmed || trimmed.length > 5000 || createMutation.isPending) return;
    setPostError(null);
    createMutation.mutate(trimmed);
  };

  const handleStartEdit = (comment: TaskCommentItem) => {
    setEditingCommentId(comment.id);
    setEditCommentText(comment.body);
    setEditError(null);
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditCommentText('');
    setEditError(null);
  };

  const handleSaveEdit = (commentId: string) => {
    const trimmed = editCommentText.trim();
    if (!trimmed || trimmed.length > 5000 || patchMutation.isPending) return;
    setEditError(null);
    patchMutation.mutate({ commentId, body: trimmed });
  };

  const trimmedNewLength = newCommentText.trim().length;
  const isNewValid = trimmedNewLength >= 1 && trimmedNewLength <= 5000;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-gray-500" />
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm sm:text-base">
            {t('projects.taskDetail.comments.title', 'Comments')} ({comments.length > 0 ? comments.length : commentCount})
          </h3>
        </div>
      </div>

      {/* Viewer Notice Banner */}
      {isViewer && (
        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2">
          <Eye className="w-4 h-4 flex-shrink-0" />
          <span>
            {t(
              'projects.taskDetail.comments.viewerNotice',
              'You can read comments, but project viewers cannot post or edit comments.'
            )}
          </span>
        </div>
      )}

      {/* Add Comment Box */}
      {canPost && (
        <form onSubmit={handlePostSubmit} className="space-y-2">
          {postError && (
            <div className="p-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-md text-xs text-red-700 dark:text-red-300 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{postError}</span>
              </div>
              <button
                type="button"
                onClick={() => setPostError(null)}
                className="text-red-500 hover:text-red-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="space-y-1">
            <textarea
              rows={3}
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              placeholder={t('projects.taskDetail.comments.inputPlaceholder', 'Write a comment or update (plain text, @mentions supported)...')}
              disabled={createMutation.isPending}
              maxLength={5000}
              className="w-full px-3 py-2 text-xs border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:outline-none"
            />

            <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
              <span
                className={`${
                  trimmedNewLength > 5000 ? 'text-red-600 dark:text-red-400 font-bold' : ''
                }`}
              >
                {trimmedNewLength} / 5000
              </span>

              <Button
                type="submit"
                size="sm"
                disabled={!isNewValid || createMutation.isPending}
                className="flex items-center gap-1 text-xs px-3 py-1"
              >
                <Send className="w-3 h-3" />
                <span>
                  {createMutation.isPending
                    ? t('common.saving', 'Posting...')
                    : t('projects.taskDetail.comments.postButton', 'Post Comment')}
                </span>
              </Button>
            </div>
          </div>
        </form>
      )}

      {/* Delete Error Banner */}
      {deleteError && (
        <div className="p-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-md text-xs text-red-700 dark:text-red-300 flex items-center justify-between gap-2">
          <span>{deleteError}</span>
          <button
            onClick={() => setDeleteError(null)}
            className="text-red-500 hover:text-red-700"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Comments List (Oldest First) */}
      <div className="space-y-3 pt-2">
        {isLoading ? (
          <div className="p-6 flex justify-center">
            <Spinner className="h-6 w-6 text-primary" />
          </div>
        ) : isError ? (
          <div className="p-4 text-center text-xs text-red-600 dark:text-red-400">
            {t('projects.taskDetail.comments.loadError', 'Failed to load comments.')}
          </div>
        ) : comments.length > 0 ? (
          <div className="space-y-3">
            {comments.map((comment) => {
              const isAuthor = currentUserId === comment.authorUserId;
              const canEditThis = canEditComment(comment, currentUserId);
              const canDeleteThis = canDeleteComment(
                comment,
                callerProjectRole,
                isSystemAdmin,
                currentUserId
              );
              const authorName = getAuthorDisplayName(comment.authorUserId, comment.authorUser);
              const isEdited = isCommentEdited(comment.createdAt, comment.updatedAt);
              const isEditing = editingCommentId === comment.id;

              return (
                <div
                  key={comment.id}
                  className="p-3.5 bg-gray-50 dark:bg-gray-750 border border-gray-150 dark:border-gray-700 rounded-lg space-y-2 text-xs"
                >
                  {/* Comment Author Header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                        {authorName}
                      </span>
                      {comment.authorUser?.systemRole === 'system_admin' && (
                        <span className="px-1.5 py-0.2 bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 rounded text-[10px] font-medium">
                          {t('roles.system_admin', 'Admin')}
                        </span>
                      )}
                      <span className="text-[11px] text-gray-400">
                        {formatDateDisplay(comment.createdAt)}
                      </span>
                      {isEdited && (
                        <span className="text-[11px] text-gray-400 italic">
                          ({t('projects.taskDetail.comments.editedMarker', 'edited')})
                        </span>
                      )}
                    </div>

                    {/* Actions: Edit & Delete */}
                    {!isEditing && (canEditThis || canDeleteThis) && (
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {canEditThis && (
                          <button
                            type="button"
                            onClick={() => handleStartEdit(comment)}
                            disabled={patchMutation.isPending || deleteMutation.isPending}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded"
                            title={t('common.edit', 'Edit')}
                            aria-label={t('common.edit', 'Edit')}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canDeleteThis && (
                          <button
                            type="button"
                            onClick={() => setCommentToDelete(comment)}
                            disabled={patchMutation.isPending || deleteMutation.isPending}
                            className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 p-1 rounded"
                            title={t('common.delete', 'Delete')}
                            aria-label={t('common.delete', 'Delete')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Comment Body or Inline Edit */}
                  {isEditing ? (
                    <div className="space-y-2 pt-1">
                      {editError && (
                        <p className="text-[11px] text-red-600 dark:text-red-400">
                          {editError}
                        </p>
                      )}
                      <textarea
                        rows={3}
                        value={editCommentText}
                        onChange={(e) => setEditCommentText(e.target.value)}
                        maxLength={5000}
                        disabled={patchMutation.isPending}
                        className="w-full px-3 py-1.5 text-xs border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:outline-none"
                      />
                      <div className="flex items-center justify-between text-[11px]">
                        <span
                          className={`${
                            editCommentText.trim().length > 5000
                              ? 'text-red-600 dark:text-red-400 font-bold'
                              : 'text-gray-400'
                          }`}
                        >
                          {editCommentText.trim().length} / 5000
                        </span>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCancelEdit}
                            disabled={patchMutation.isPending}
                            className="text-xs px-2.5 py-1"
                          >
                            {t('common.cancel', 'Cancel')}
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleSaveEdit(comment.id)}
                            disabled={
                              !editCommentText.trim() ||
                              editCommentText.trim().length > 5000 ||
                              patchMutation.isPending
                            }
                            className="text-xs px-2.5 py-1"
                          >
                            {patchMutation.isPending
                              ? t('common.saving', 'Saving...')
                              : t('common.save', 'Save')}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words leading-relaxed">
                      {comment.body}
                    </p>
                  )}
                </div>
              );
            })}

            {/* Load More Button (Oldest First Cursor Pagination) */}
            {hasNextPage && (
              <div className="pt-2 text-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="text-xs"
                >
                  {isFetchingNextPage ? (
                    <div className="flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{t('common.loading', 'Loading...')}</span>
                    </div>
                  ) : (
                    <span>{t('projects.taskDetail.comments.loadMore', 'Load older comments')}</span>
                  )}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-400 dark:text-gray-500 italic p-3 border border-dashed border-gray-200 dark:border-gray-700 rounded-md">
            {t('projects.taskDetail.comments.noComments', 'No comments yet. Start the conversation!')}
          </p>
        )}
      </div>

      {/* Delete Comment Confirmation Dialog */}
      {commentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-600" />
              <span>{t('projects.taskDetail.comments.deleteTitle', 'Delete Comment')}</span>
            </h3>

            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
              {t(
                'projects.taskDetail.comments.deleteConfirmText',
                'Are you sure you want to delete this comment? This action cannot be undone.'
              )}
            </p>

            <div className="flex justify-end gap-3 pt-3 border-t dark:border-gray-700">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCommentToDelete(null)}
                disabled={deleteMutation.isPending}
              >
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteMutation.mutate(commentToDelete.id)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending
                  ? t('common.deleting', 'Deleting...')
                  : t('common.delete', 'Delete')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
