import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { X, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button.js';
import { createTask, fetchProjectMilestones, fetchProjectTasks, getProjectErrorInfo } from '../../api/projects.js';
import type { ProjectDetail, CreateTaskPayload } from '../../types/index.js';

interface CreateTaskModalProps {
  project: ProjectDetail;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateTaskModal({ project, isOpen, onClose, onSuccess }: CreateTaskModalProps) {
  const { t } = useTranslation();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [assigneeUserId, setAssigneeUserId] = useState('');
  const [milestoneId, setMilestoneId] = useState('');
  const [parentTaskId, setParentTaskId] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Eligible assignees: active project members with manager or member role (never viewer)
  const eligibleAssignees = React.useMemo(() => {
    return (project.members || []).filter(
      (m) => m.user?.isActive !== false && (m.projectRole === 'manager' || m.projectRole === 'member')
    );
  }, [project.members]);

  // Fetch project milestones
  const { data: milestones } = useQuery({
    queryKey: ['projectMilestones', project.id],
    queryFn: () => fetchProjectMilestones(project.id),
    enabled: isOpen,
    staleTime: 60000,
  });

  // Fetch top-level tasks for optional parent selection
  const { data: topLevelTasksData } = useQuery({
    queryKey: ['topLevelTasks', project.id],
    queryFn: () => fetchProjectTasks(project.id, { topLevelOnly: true, limit: 100 }),
    enabled: isOpen,
    staleTime: 30000,
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setErrorMessage(t('projects.tasks.create.titleRequired', 'Task title is required.'));
      return;
    }

    if (trimmedTitle.length > 200) {
      setErrorMessage(t('projects.tasks.create.titleTooLong', 'Task title must be 200 characters or less.'));
      return;
    }

    let parsedHours: number | null = null;
    if (estimatedHours.trim()) {
      const h = parseFloat(estimatedHours);
      if (isNaN(h) || h <= 0) {
        setErrorMessage(t('projects.tasks.create.hoursPositive', 'Estimated hours must be greater than 0.'));
        return;
      }
      if (Math.abs(h * 4 - Math.round(h * 4)) > 1e-9) {
        setErrorMessage(t('projects.tasks.create.hoursQuarterStep', 'Estimated hours must be in 0.25h increments.'));
        return;
      }
      if (h > 1000) {
        setErrorMessage(t('projects.tasks.create.hoursMax', 'Estimated hours cannot exceed 1000h.'));
        return;
      }
      parsedHours = h;
    }

    const payload: CreateTaskPayload = {
      title: trimmedTitle,
      description: description.trim() ? description.trim() : null,
      dueDate: dueDate || null,
      estimatedHours: parsedHours,
      assigneeUserId: assigneeUserId || null,
      milestoneId: milestoneId || null,
      parentTaskId: parentTaskId || null,
    };

    setIsSubmitting(true);
    try {
      await createTask(project.id, payload);
      // Reset form
      setTitle('');
      setDescription('');
      setDueDate('');
      setEstimatedHours('');
      setAssigneeUserId('');
      setMilestoneId('');
      setParentTaskId('');
      onSuccess();
    } catch (err: any) {
      const errInfo = getProjectErrorInfo(err);
      if (errInfo.error === 'invalid_assignee') {
        setErrorMessage(t('projects.tasks.create.errors.invalidAssignee', 'Selected assignee is not an active member or has a viewer role.'));
      } else if (errInfo.error === 'invalid_milestone') {
        setErrorMessage(t('projects.tasks.create.errors.invalidMilestone', 'Selected milestone does not belong to this project.'));
      } else if (errInfo.error === 'invalid_subtask_nesting') {
        setErrorMessage(t('projects.tasks.create.errors.invalidNesting', 'Subtasks cannot be nested more than one level deep.'));
      } else if (errInfo.error === 'validation_error') {
        setErrorMessage(errInfo.message || t('projects.tasks.create.errors.validation', 'Validation failed. Please check form values.'));
      } else if (errInfo.status === 403) {
        setErrorMessage(t('projects.tasks.create.errors.forbidden', 'You do not have permission to create tasks in this project.'));
      } else {
        setErrorMessage(errInfo.message || t('projects.tasks.create.errors.generic', 'Failed to create task.'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full p-6 relative my-8">
        <button
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          aria-label={t('common.close', 'Close')}
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          {t('projects.tasks.create.title', 'Create New Task')}
        </h2>

        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('projects.tasks.create.fields.title', 'Title')} *
            </label>
            <input
              type="text"
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('projects.tasks.create.placeholders.title', 'e.g. Implement user authentication')}
              className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:outline-none"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('projects.tasks.create.fields.description', 'Description')}
            </label>
            <textarea
              rows={3}
              maxLength={5000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('projects.tasks.create.placeholders.description', 'Optional task details or acceptance criteria...')}
              className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:outline-none"
              disabled={isSubmitting}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('projects.tasks.create.fields.dueDate', 'Due Date')}
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:outline-none"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('projects.tasks.create.fields.estimatedHours', 'Estimated Hours')}
              </label>
              <input
                type="number"
                step="0.25"
                min="0.25"
                max="1000"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
                placeholder="e.g. 4.5"
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:outline-none"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('projects.tasks.create.fields.assignee', 'Assignee')}
              </label>
              <select
                value={assigneeUserId}
                onChange={(e) => setAssigneeUserId(e.target.value)}
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:outline-none"
                disabled={isSubmitting}
              >
                <option value="">{t('projects.tasks.create.unassigned', 'Unassigned')}</option>
                {eligibleAssignees.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.user?.displayName || m.user?.username || m.userId} ({m.projectRole})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('projects.tasks.create.fields.milestone', 'Milestone')}
              </label>
              <select
                value={milestoneId}
                onChange={(e) => setMilestoneId(e.target.value)}
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:outline-none"
                disabled={isSubmitting}
              >
                <option value="">{t('projects.tasks.create.noMilestone', 'No Milestone')}</option>
                {(milestones || []).map((ms) => (
                  <option key={ms.id} value={ms.id}>
                    {ms.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('projects.tasks.create.fields.parentTask', 'Parent Task (Optional)')}
            </label>
            <select
              value={parentTaskId}
              onChange={(e) => setParentTaskId(e.target.value)}
              className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:outline-none"
              disabled={isSubmitting}
            >
              <option value="">{t('projects.tasks.create.noParentTask', 'None (Top-level task)')}</option>
              {(topLevelTasksData?.items || []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {t('projects.tasks.create.parentTaskHelp', 'Subtasks are limited to one level of nesting.')}
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t dark:border-gray-700">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('projects.tasks.create.submitting', 'Creating...') : t('projects.tasks.create.submit', 'Create Task')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
