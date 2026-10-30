import React from 'react';
import { useTranslation } from 'react-i18next';
import { Milestone, Clock, Calendar } from 'lucide-react';
import type { ProjectDetail } from '../../types/index.js';

interface MilestonesTabPlaceholderProps {
  project: ProjectDetail;
}

export function MilestonesTabPlaceholder({ project }: MilestonesTabPlaceholderProps) {
  const { t } = useTranslation();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-12 text-center">
      <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-4">
        <Milestone className="w-6 h-6" />
      </div>

      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
        {t('projects.milestones.placeholderTitle', 'Milestone Management')}
      </h3>

      <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md mx-auto mb-6">
        {t(
          'projects.milestones.placeholderNotice',
          'Milestone management is coming in the next step. Project milestones and their task dependencies will be manageable directly from this tab.'
        )}
      </p>

      {project.startDate && project.targetDate && (
        <div className="inline-flex items-center gap-3 px-4 py-2 bg-gray-50 dark:bg-gray-900 rounded-md text-xs text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800">
          <Calendar className="w-4 h-4 text-gray-500" />
          <span>
            {t('projects.detail.dates', 'Project Duration')}: {project.startDate} &rarr; {project.targetDate}
          </span>
        </div>
      )}
    </div>
  );
}
