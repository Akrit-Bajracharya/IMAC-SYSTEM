import React, { useState, useRef, useMemo } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  MessageSquare,
  Pin,
  PinOff,
  CheckSquare,
  AlertCircle,
  Loader2,
  Info,
  ExternalLink,
  Send,
} from 'lucide-react';
import { Button } from '../ui/button.js';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert.js';
import { ConfirmationModal } from '../common/ConfirmationModal.js';
import {
  fetchProjectMessages,
  createProjectMessage,
  pinProjectMessage,
  unpinProjectMessage,
  convertProjectMessageToTask,
} from '../../api/projects.js';
import {
  canPostMessage,
  canPinMessage,
  canConvertToTask,
  deduplicateMessagesById,
  getConvertedMessageKey,
  isMessageConverted,
  mapProjectMessageError,
  type ConvertedMessageInfo,
} from '../../lib/projectMessageHelpers.js';
import { formatDateTimeDisplay } from '../../lib/dateUtils.js';
import { getTaskDetailPath } from '../../lib/taskLinks.js';
import { invalidateProjectTaskCaches } from '../../lib/projectTaskCache.js';
import type { ProjectDetail, AuthUser, ProjectRole, ProjectMessage } from '../../types/index.js';

interface MessagesTabProps {
  project: ProjectDetail;
  currentUser: AuthUser | null;
  callerProjectRole?: ProjectRole;
  isSystemAdmin: boolean;
}

export function MessagesTab({
  project,
  currentUser,
  callerProjectRole,
  isSystemAdmin,
}: MessagesTabProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Local state
  const [messageBody, setMessageBody] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [cursorRecoveryNotice, setCursorRecoveryNotice] = useState<string | null>(null);
  const [convertingMessage, setConvertingMessage] = useState<ProjectMessage | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [recentlyConvertedTask, setRecentlyConvertedTask] = useState<{
    id: string;
    title: string;
  } | null>(null);

  // In-session converted message tracking (keyed by `${projectId}:${messageId}`)
  const [convertedMap, setConvertedMap] = useState<Record<string, ConvertedMessageInfo>>({});

  // Double submit ref guard
  const isSubmittingPostRef = useRef(false);
  const cursorRecoveredRef = useRef(false);

  // Capabilities
  const canPost = useMemo(() => {
    return canPostMessage(callerProjectRole, currentUser?.systemRole);
  }, [callerProjectRole, currentUser?.systemRole]);

  const canPin = useMemo(() => {
    return canPinMessage(callerProjectRole, currentUser?.systemRole);
  }, [callerProjectRole, currentUser?.systemRole]);

  const canConvert = useMemo(() => {
    return canConvertToTask(callerProjectRole, currentUser?.systemRole, currentUser?.id);
  }, [callerProjectRole, currentUser?.systemRole, currentUser?.id]);

  // Query Key for Messages
  const messagesQueryKey = useMemo(() => {
    return ['projectMessagesInfinite', project.id] as const;
  }, [project.id]);

  // 1. Data loading with useInfiniteQuery
  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: messagesQueryKey,
    queryFn: async ({ pageParam }) => {
      try {
        return await fetchProjectMessages(project.id, { limit: 50, cursor: pageParam });
      } catch (err: any) {
        // Handle invalid_cursor error by recovering to page 1 once
        const errorInfo = mapProjectMessageError(err);
        if (errorInfo.code === 'invalid_cursor' && !cursorRecoveredRef.current) {
          cursorRecoveredRef.current = true;
          setCursorRecoveryNotice(
            t(
              'projects.messages.errors.invalidCursor',
              'Message list was refreshed due to an updated cursor.'
            )
          );
          // Return first page without cursor
          return await fetchProjectMessages(project.id, { limit: 50 });
        }
        throw err;
      }
    },
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
    initialPageParam: undefined as string | undefined,
    staleTime: 0,
  });

  // Flatten and deduplicate messages by ID preserving server order
  const messages = useMemo(() => {
    if (!data?.pages) return [];
    return deduplicateMessagesById(data.pages);
  }, [data?.pages]);

  // Member map for author lookup fallback
  const memberNameMap = useMemo(() => {
    const map = new Map<string, string>();
    if (project.members) {
      for (const m of project.members) {
        if (m.userId && m.user?.displayName) {
          map.set(m.userId, m.user.displayName);
        }
      }
    }
    return map;
  }, [project.members]);

  const resolveAuthorName = (msg: ProjectMessage): string => {
    if (msg.authorUser?.displayName) {
      return msg.authorUser.displayName;
    }
    const memberName = memberNameMap.get(msg.authorUserId);
    if (memberName) {
      return memberName;
    }
    return t('projects.messages.formerMember', 'Former member');
  };

  // 2. Post Message Mutation
  const postMutation = useMutation({
    mutationFn: (bodyText: string) => createProjectMessage(project.id, bodyText),
    onSuccess: () => {
      setMessageBody('');
      setActionError(null);
      queryClient.resetQueries({ queryKey: messagesQueryKey });
    },
    onError: (err: any) => {
      const errInfo = mapProjectMessageError(err);
      setActionError(t(errInfo.messageKey, errInfo.defaultMessage));
    },
    onSettled: () => {
      isSubmittingPostRef.current = false;
    },
  });

  const handlePostSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (postMutation.isPending || isSubmittingPostRef.current) return;

    const trimmed = messageBody.trim();
    if (trimmed.length < 1 || trimmed.length > 5000) {
      setActionError(
        t(
          'projects.messages.errors.validationError',
          'Message body must be between 1 and 5000 characters'
        )
      );
      return;
    }

    isSubmittingPostRef.current = true;
    setActionError(null);
    postMutation.mutate(trimmed);
  };

  // 3. Pin / Unpin Mutations
  const pinMutation = useMutation({
    mutationFn: ({ messageId, isPinned }: { messageId: string; isPinned: boolean }) =>
      isPinned ? unpinProjectMessage(project.id, messageId) : pinProjectMessage(project.id, messageId),
    onSuccess: () => {
      setActionError(null);
      queryClient.resetQueries({ queryKey: messagesQueryKey });
    },
    onError: (err: any) => {
      const errInfo = mapProjectMessageError(err);
      setActionError(t(errInfo.messageKey, errInfo.defaultMessage));
      refetch();
    },
  });

  // 4. Convert to Task Mutation
  const handleConfirmConvert = async () => {
    if (!convertingMessage) return;

    setIsConverting(true);
    setActionError(null);

    const messageId = convertingMessage.id;
    try {
      const res = await convertProjectMessageToTask(project.id, messageId);

      // Record in session tracking
      setConvertedMap((prev) => ({
        ...prev,
        [getConvertedMessageKey(project.id, messageId)]: {
          taskId: res.task.id,
          taskTitle: res.task.title,
        },
      }));

      setRecentlyConvertedTask({
        id: res.task.id,
        title: res.task.title,
      });

      // Await invalidation of all task and summary caches
      await invalidateProjectTaskCaches(queryClient, project.id);
      setConvertingMessage(null);
    } catch (err: any) {
      const errInfo = mapProjectMessageError(err);

      // If already converted (409), remember in session tracking
      if (errInfo.code === 'already_converted') {
        setConvertedMap((prev) => ({
          ...prev,
          [getConvertedMessageKey(project.id, messageId)]: { taskId: undefined },
        }));
      }

      setActionError(t(errInfo.messageKey, errInfo.defaultMessage));
      setConvertingMessage(null);
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Alert Notices */}
      {cursorRecoveryNotice && (
        <Alert variant="default" className="border-amber-200 bg-amber-50 dark:bg-amber-950/30">
          <Info className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800 dark:text-amber-300">
            {t('common.info', 'Notice')}
          </AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-400">
            {cursorRecoveryNotice}
          </AlertDescription>
        </Alert>
      )}

      {actionError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('common.error', 'Error')}</AlertTitle>
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}

      {recentlyConvertedTask && (
        <Alert className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30">
          <CheckSquare className="h-4 w-4 text-emerald-600" />
          <AlertTitle className="text-emerald-800 dark:text-emerald-300">
            {t('projects.messages.convertedSuccessTitle', 'Task Created')}
          </AlertTitle>
          <AlertDescription className="text-emerald-700 dark:text-emerald-400 flex flex-wrap items-center gap-2 mt-1">
            <span>{t('projects.messages.convertedSuccessDesc', 'Task created successfully:')}</span>
            <a
              href={getTaskDetailPath(project.id, recentlyConvertedTask.id, currentUser?.systemRole)}
              className="font-medium underline inline-flex items-center gap-1 hover:text-emerald-900 dark:hover:text-emerald-200"
            >
              <span>{recentlyConvertedTask.title}</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </AlertDescription>
        </Alert>
      )}

      {/* Post Message Section */}
      <div className="border rounded-xl p-5 bg-card space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-base flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <span>{t('projects.messages.title', 'Project Messages')}</span>
          </h3>
          <span className="text-xs text-muted-foreground">
            {t('projects.messages.count', {
              count: messages.length,
              defaultValue: '{{count}} messages loaded',
            })}
          </span>
        </div>

        {canPost ? (
          <form onSubmit={handlePostSubmit} className="space-y-3">
            <div className="space-y-1">
              <textarea
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                placeholder={t(
                  'projects.messages.postPlaceholder',
                  'Share an update, note, or question with the project team...'
                )}
                rows={3}
                maxLength={5000}
                disabled={postMutation.isPending}
                className="w-full text-sm p-3 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y min-h-[80px]"
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{t('projects.messages.charHint', 'Plain text; first line becomes task title upon conversion.')}</span>
                <span
                  className={
                    messageBody.length > 5000
                      ? 'text-destructive font-bold'
                      : messageBody.length > 4500
                      ? 'text-amber-600 font-medium'
                      : ''
                  }
                >
                  {messageBody.length} / 5000
                </span>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={
                  postMutation.isPending ||
                  isSubmittingPostRef.current ||
                  messageBody.trim().length === 0 ||
                  messageBody.length > 5000
                }
                className="gap-2"
              >
                {postMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{t('projects.messages.posting', 'Posting...')}</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>{t('projects.messages.postButton', 'Post Message')}</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex items-start gap-2 bg-muted/50 p-3 rounded-lg text-xs text-muted-foreground">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              {t(
                'projects.messages.viewerNotice',
                'You have read-only access to project messages. Posting is reserved for project members and managers.'
              )}
            </span>
          </div>
        )}
      </div>

      {/* Messages List Section */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="border rounded-xl p-8 bg-card flex flex-col items-center justify-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {t('projects.messages.loading', 'Loading messages...')}
            </p>
          </div>
        ) : isError ? (
          <div className="border rounded-xl p-6 bg-card text-center space-y-3">
            <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
            <p className="text-sm text-destructive font-medium">
              {t('projects.messages.loadFailed', 'Failed to load project messages.')}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              {t('common.retry', 'Retry')}
            </Button>
          </div>
        ) : messages.length === 0 ? (
          <div className="border rounded-xl p-8 bg-card text-center space-y-2">
            <MessageSquare className="h-10 w-10 text-muted-foreground/50 mx-auto" />
            <p className="text-sm font-medium">{t('projects.messages.emptyTitle', 'No messages yet')}</p>
            <p className="text-xs text-muted-foreground">
              {t(
                'projects.messages.emptyDesc',
                'Start a discussion or post team notes for this project.'
              )}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => {
              const authorName = resolveAuthorName(msg);
              const formattedTime = formatDateTimeDisplay(msg.createdAt);
              const isConverted = isMessageConverted(convertedMap, project.id, msg.id);
              const convertedInfo = convertedMap[getConvertedMessageKey(project.id, msg.id)];

              return (
                <div
                  key={msg.id}
                  className={`border rounded-xl p-4 sm:p-5 bg-card space-y-3 transition-colors ${
                    msg.isPinned
                      ? 'border-primary/40 bg-primary/[0.02] shadow-sm'
                      : 'hover:border-muted-foreground/30'
                  }`}
                >
                  {/* Card Header: Author, Date, Badges & Actions */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b pb-2.5">
                    <div className="flex items-center flex-wrap gap-2">
                      <span className="font-semibold text-sm">{authorName}</span>
                      <span className="text-xs text-muted-foreground">
                        {formattedTime}
                      </span>
                      {msg.isPinned && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                          <Pin className="h-3 w-3 fill-primary/30" />
                          <span>{t('projects.messages.pinned', 'Pinned')}</span>
                        </span>
                      )}
                      {isConverted && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                          <CheckSquare className="h-3 w-3" />
                          <span>{t('projects.messages.convertedBadge', 'Converted')}</span>
                          {convertedInfo?.taskId && (
                            <a
                              href={getTaskDetailPath(project.id, convertedInfo.taskId, currentUser?.systemRole)}
                              className="underline hover:text-emerald-900 dark:hover:text-emerald-100 ml-0.5"
                              title={convertedInfo.taskTitle || 'View Task'}
                            >
                              <ExternalLink className="h-2.5 w-2.5 inline" />
                            </a>
                          )}
                        </span>
                      )}
                    </div>

                    {/* Actions Menu */}
                    <div className="flex items-center gap-1.5 self-end sm:self-auto">
                      {/* Pin / Unpin Button (Managers & System Admin only) */}
                      {canPin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => pinMutation.mutate({ messageId: msg.id, isPinned: msg.isPinned })}
                          disabled={pinMutation.isPending}
                          className="h-8 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                          title={msg.isPinned ? t('projects.messages.unpin', 'Unpin message') : t('projects.messages.pin', 'Pin message')}
                        >
                          {msg.isPinned ? (
                            <>
                              <PinOff className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">{t('projects.messages.unpin', 'Unpin')}</span>
                            </>
                          ) : (
                            <>
                              <Pin className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">{t('projects.messages.pin', 'Pin')}</span>
                            </>
                          )}
                        </Button>
                      )}

                      {/* Turn into Task Button */}
                      {canConvert && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setConvertingMessage(msg)}
                          disabled={isConverting}
                          className="h-8 px-2 text-xs gap-1"
                        >
                          <CheckSquare className="h-3.5 w-3.5 text-primary" />
                          <span>{t('projects.messages.toTaskButton', 'Turn into task')}</span>
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Message Body: Strictly Plain Text with whitespace-pre-wrap */}
                  <div className="text-sm leading-relaxed whitespace-pre-wrap break-words font-sans text-foreground">
                    {msg.body}
                  </div>
                </div>
              );
            })}

            {/* Load More Button */}
            {hasNextPage && (
              <div className="pt-2 flex justify-center">
                <Button
                  variant="outline"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="gap-2"
                >
                  {isFetchingNextPage ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{t('common.loadingMore', 'Loading older messages...')}</span>
                    </>
                  ) : (
                    <span>{t('projects.messages.loadMore', 'Load older messages')}</span>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Convert to Task Confirmation Modal */}
      <ConfirmationModal
        open={!!convertingMessage}
        onOpenChange={(open) => {
          if (!open) setConvertingMessage(null);
        }}
        title={t('projects.messages.convertDialog.title', 'Convert Message to Task')}
        description={t(
          'projects.messages.convertDialog.description',
          'One unassigned task in "To do" will be created by you from this message. The first line becomes the title (up to 200 characters), the whole message becomes the description, the message itself stays unchanged, and a message can be converted only once.'
        )}
        confirmLabel={t('projects.messages.convertDialog.confirm', 'Convert to Task')}
        cancelLabel={t('common.cancel', 'Cancel')}
        isLoading={isConverting}
        onConfirm={handleConfirmConvert}
      />
    </div>
  );
}
