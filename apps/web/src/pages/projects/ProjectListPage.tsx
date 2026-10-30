import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  FolderKanban,
  Search,
  Plus,
  Users,
  Calendar,
  AlertCircle,
  RefreshCw,
  FolderOpen,
} from 'lucide-react';
import { fetchProjects } from '../../api/projects.js';
import { useAuth } from '../../hooks/useAuth.js';
import { Button } from '../../components/ui/button.js';
import { Input } from '../../components/ui/input.js';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert.js';
import { ProjectStatusBadge } from '../../components/projects/ProjectStatusBadge.js';
import { CreateProjectModal } from '../../components/projects/CreateProjectModal.js';
import type { ProjectListItem, ProjectDetail } from '../../types/index.js';

export function ProjectListPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const isPrivileged = user?.systemRole === 'system_admin' || user?.systemRole === 'project_manager';
  const basePath = user && ['system_admin', 'hr_admin'].includes(user.systemRole)
    ? '/admin/projects'
    : '/employee/projects';

  const [search, setSearch] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [projectsList, setProjectsList] = useState<ProjectListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Initial fetch
  const {
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['projects', 'list'],
    queryFn: async () => {
      const data = await fetchProjects({ limit: 50 });
      setProjectsList(data.items);
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
      return data;
    },
  });

  const handleLoadMore = async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const data = await fetchProjects({ limit: 50, cursor: nextCursor });
      setProjectsList((prev) => [...prev, ...data.items]);
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch (err) {
      // Handled silently or error state
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleProjectCreated = (newProject: ProjectDetail) => {
    // Prepend to current list
    setProjectsList((prev) => [
      {
        id: newProject.id,
        name: newProject.name,
        description: newProject.description,
        status: newProject.status,
        startDate: newProject.startDate,
        targetDate: newProject.targetDate,
        createdByUserId: newProject.createdByUserId,
        createdAt: newProject.createdAt,
        updatedAt: newProject.updatedAt,
        memberCount: newProject.memberCount ?? 1,
      },
      ...prev,
    ]);
    navigate(`${basePath}/${newProject.id}`);
  };

  // Browser-level search filtering over loaded projects
  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projectsList;
    return projectsList.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q))
    );
  }, [projectsList, search]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FolderKanban className="h-6 w-6 text-primary" />
            {t('projects.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t('projects.subtitle')}
          </p>
        </div>

        {isPrivileged && (
          <Button
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-2 self-start sm:self-auto"
          >
            <Plus className="h-4 w-4" />
            {t('projects.createProject')}
          </Button>
        )}
      </div>

      {/* Filter / Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('projects.searchPlaceholder')}
            className="pl-9 text-sm"
          />
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center p-12 text-muted-foreground space-y-3">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium">{t('projects.loading')}</p>
        </div>
      )}

      {/* Error State */}
      {!isLoading && isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('projects.errorTitle')}</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>{(error as any)?.message || t('common.error')}</span>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="ml-4">
              {t('common.retry')}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Empty State */}
      {!isLoading && !isError && filteredProjects.length === 0 && (
        <div className="border rounded-xl p-12 text-center bg-card flex flex-col items-center justify-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
            <FolderOpen className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold">{t('projects.emptyTitle')}</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            {user?.systemRole === 'system_admin'
              ? t('projects.emptyAdminDesc')
              : t('projects.emptyDesc')}
          </p>
          {isPrivileged && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreateModalOpen(true)}
              className="mt-2"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              {t('projects.createProject')}
            </Button>
          )}
        </div>
      )}

      {/* Projects Grid / List */}
      {!isLoading && !isError && filteredProjects.length > 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map((project) => (
              <div
                key={project.id}
                onClick={() => navigate(`${basePath}/${project.id}`)}
                className="group border rounded-xl p-5 bg-card hover:border-primary/50 hover:shadow-sm transition cursor-pointer flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-base group-hover:text-primary transition line-clamp-1">
                      {project.name}
                    </h3>
                    <ProjectStatusBadge status={project.status} />
                  </div>
                  {project.description ? (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {project.description}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground/60 italic">
                      {t('projects.detail.noDescription')}
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    <span>
                      {t('projects.memberCount', {
                        count: project.memberCount,
                        defaultValue: `${project.memberCount} members`,
                      })}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>
                      {project.targetDate
                        ? t('projects.targetDate', {
                            date: project.targetDate.slice(0, 10),
                          })
                        : t('projects.noTargetDate')}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Load More Button */}
          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="flex items-center gap-2"
              >
                {isLoadingMore ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    {t('common.loading')}
                  </>
                ) : (
                  t('projects.loadMore')
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      <CreateProjectModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSuccess={handleProjectCreated}
      />
    </div>
  );
}
