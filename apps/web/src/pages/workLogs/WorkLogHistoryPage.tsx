import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Calendar as CalendarIcon,
  List,
  ChevronLeft,
  ChevronRight,
  Clock,
  Briefcase,
  ExternalLink,
  RefreshCw,
  BarChart2,
  CalendarDays,
  AlertCircle,
} from 'lucide-react';

import { useAuth } from '../../hooks/useAuth.js';
import { fetchWorkLogsByMonth, fetchWorkLogsByWeek } from '../../api/workLogs.js';
import {
  getKathmanduToday,
  parseYmd,
  formatYmd,
  getDaysInMonth,
  getFirstWeekdayOfMonth,
  formatDateDisplay,
  getWeekMonday,
  addDays,
  calculateShiftDifference,
} from '../../lib/dateUtils.js';
import { Button } from '../../components/ui/button.js';
import { Input } from '../../components/ui/input.js';
import { Label } from '../../components/ui/label.js';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card.js';
import { WorkLogStatusBadge } from '../../components/common/WorkLogStatusBadge.js';
import type { WorkLogDay, WorkLogEntry } from '../../types/index.js';

export function WorkLogHistoryPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Parse today's Kathmandu date for initial state
  const todayStr = getKathmanduToday();
  const todayYmd = parseYmd(todayStr);

  const [currentYear, setCurrentYear] = useState<number>(todayYmd.year);
  const [currentMonth, setCurrentMonth] = useState<number>(todayYmd.month);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [activeTab, setActiveTab] = useState<'month' | 'week'>('month');

  // Week summary starting date (Monday)
  const [weekStartDate, setWeekStartDate] = useState<string>(getWeekMonday(todayStr));

  // Determine base route prefix for navigation
  const isPrivileged = user && ['system_admin', 'hr_admin'].includes(user.systemRole);
  const dailyLogBasePath = isPrivileged ? '/admin/work-log' : '/employee/work-log';

  const handleOpenDay = (dateStr: string) => {
    navigate(`${dailyLogBasePath}?date=${dateStr}`);
  };

  // Month navigation
  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  // 1. Fetch Month Logs Query
  const {
    data: monthData,
    isLoading: isLoadingMonth,
    isError: isMonthError,
    refetch: refetchMonth,
  } = useQuery({
    queryKey: ['work-logs', 'by-month', currentYear, currentMonth],
    queryFn: () => fetchWorkLogsByMonth(currentYear, currentMonth),
  });

  // 2. Fetch Week Logs Query
  const {
    data: weekData,
    isLoading: isLoadingWeek,
    refetch: refetchWeek,
  } = useQuery({
    queryKey: ['work-logs', 'by-week', weekStartDate],
    queryFn: () => fetchWorkLogsByWeek(weekStartDate),
    enabled: activeTab === 'week',
  });

  const monthLogs = useMemo(() => monthData?.workLogs ?? [], [monthData]);
  const standardShiftHours = monthData?.standardShiftHours ?? 8;

  // Map of date string (YYYY-MM-DD) -> WorkLogDay
  const logsByDateMap = useMemo(() => {
    const map = new Map<string, WorkLogDay>();
    for (const log of monthLogs) {
      // log.date is ISO or YYYY-MM-DD
      const dateKey = log.date.split('T')[0];
      map.set(dateKey, log);
    }
    return map;
  }, [monthLogs]);

  // Aggregate monthly totals and work role distribution
  const monthSummary = useMemo(() => {
    let totalHours = 0;
    const roleHoursMap = new Map<string, { roleName: string; hours: number }>();

    for (const log of monthLogs) {
      for (const entry of log.entries || []) {
        totalHours += entry.hours;
        const roleId = entry.workRoleId;
        const roleName = entry.workRole?.name || roleId;
        const existing = roleHoursMap.get(roleId) || { roleName, hours: 0 };
        existing.hours += entry.hours;
        roleHoursMap.set(roleId, existing);
      }
    }

    const rolesBreakdown = Array.from(roleHoursMap.values()).sort(
      (a, b) => b.hours - a.hours
    );

    const loggedDaysCount = monthLogs.length;
    const expectedHours = loggedDaysCount * standardShiftHours;
    const diff = calculateShiftDifference(totalHours, expectedHours);

    return {
      totalHours,
      loggedDaysCount,
      expectedHours,
      diff,
      rolesBreakdown,
    };
  }, [monthLogs, standardShiftHours]);

  // Aggregate weekly totals
  const weekSummary = useMemo(() => {
    const weekLogs = weekData?.workLogs ?? [];
    let totalHours = 0;
    const roleHoursMap = new Map<string, { roleName: string; hours: number }>();
    const dayTotalsMap = new Map<string, { totalHours: number; status?: string }>();

    for (const log of weekLogs) {
      const dateKey = log.date.split('T')[0];
      let daySum = 0;
      for (const entry of log.entries || []) {
        daySum += entry.hours;
        totalHours += entry.hours;
        const roleId = entry.workRoleId;
        const roleName = entry.workRole?.name || roleId;
        const existing = roleHoursMap.get(roleId) || { roleName, hours: 0 };
        existing.hours += entry.hours;
        roleHoursMap.set(roleId, existing);
      }
      dayTotalsMap.set(dateKey, { totalHours: daySum, status: log.status });
    }

    // Generate 7 days from weekStartDate
    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const dStr = addDays(weekStartDate, i);
      const dayData = dayTotalsMap.get(dStr);
      return {
        dateStr: dStr,
        totalHours: dayData?.totalHours ?? 0,
        status: dayData?.status,
      };
    });

    const rolesBreakdown = Array.from(roleHoursMap.values()).sort(
      (a, b) => b.hours - a.hours
    );

    const expectedHours = 5 * standardShiftHours; // 5 working days default
    const diff = calculateShiftDifference(totalHours, expectedHours);

    return {
      weekDays,
      totalHours,
      expectedHours,
      diff,
      rolesBreakdown,
    };
  }, [weekData, weekStartDate, standardShiftHours]);

  // Calendar calculations
  const daysInCurrentMonth = getDaysInMonth(currentYear, currentMonth);
  const firstWeekday = getFirstWeekdayOfMonth(currentYear, currentMonth); // 0 = Sun, 1 = Mon...

  const calendarDays = useMemo(() => {
    const cells: { dateStr: string; dayNumber: number; inMonth: boolean; log?: WorkLogDay }[] = [];

    // Blank cells before month starts
    for (let i = 0; i < firstWeekday; i++) {
      cells.push({ dateStr: '', dayNumber: 0, inMonth: false });
    }

    // Days in current month
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const dateStr = formatYmd(currentYear, currentMonth, d);
      const log = logsByDateMap.get(dateStr);
      cells.push({ dateStr, dayNumber: d, inMonth: true, log });
    }

    return cells;
  }, [currentYear, currentMonth, daysInCurrentMonth, firstWeekday, logsByDateMap]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Page Title & View Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t('workLog.history.pageTitle')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('workLog.history.pageSubtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Main Tab Toggle: Month vs Week */}
          <div className="inline-flex rounded-lg border bg-muted p-1">
            <button
              type="button"
              onClick={() => setActiveTab('month')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                activeTab === 'month'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5 inline mr-1" />
              {t('workLog.history.monthSummaryTitle')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('week')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                activeTab === 'week'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5 inline mr-1" />
              {t('workLog.history.weekSummaryTitle')}
            </button>
          </div>
        </div>
      </div>

      {/* MONTH VIEW SECTION */}
      {activeTab === 'month' && (
        <div className="space-y-6">
          {/* Month Controls & Calendar/List Toggle */}
          <Card>
            <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {/* Month Navigator */}
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handlePrevMonth}
                  title={t('workLog.history.prevMonth')}
                  className="h-9 w-9 p-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>

                <div className="text-base font-semibold min-w-[170px] text-center">
                  {monthNames[currentMonth - 1]} {currentYear}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleNextMonth}
                  title={t('workLog.history.nextMonth')}
                  className="h-9 w-9 p-0"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCurrentYear(todayYmd.year);
                    setCurrentMonth(todayYmd.month);
                  }}
                  className="text-xs"
                >
                  {t('workLog.daily.today')}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => refetchMonth()}
                  className="h-8 w-8 p-0"
                  disabled={isLoadingMonth}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingMonth ? 'animate-spin' : ''}`} />
                </Button>
              </div>

              {/* Calendar vs List View Toggle */}
              <div className="inline-flex rounded-lg border bg-muted p-1 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setViewMode('calendar')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                    viewMode === 'calendar'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <CalendarIcon className="w-3.5 h-3.5 inline mr-1" />
                  {t('workLog.history.calendarView')}
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                    viewMode === 'list'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <List className="w-3.5 h-3.5 inline mr-1" />
                  {t('workLog.history.listView')}
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Monthly Shift Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 sm:p-5">
                <span className="text-xs text-muted-foreground block">
                  {t('workLog.history.overallTotal')}
                </span>
                <span className="text-2xl font-bold font-mono text-primary mt-1 block">
                  {monthSummary.totalHours.toFixed(2)}h
                </span>
                <span className="text-xs text-muted-foreground mt-1 block">
                  Across {monthSummary.loggedDaysCount} recorded days
                </span>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 sm:p-5">
                <span className="text-xs text-muted-foreground block">
                  {t('workLog.history.expectedTotal')}
                </span>
                <span className="text-2xl font-bold font-mono mt-1 block">
                  {monthSummary.expectedHours.toFixed(2)}h
                </span>
                <span className="text-xs text-muted-foreground mt-1 block">
                  Base standard shift: {standardShiftHours.toFixed(2)}h / day
                </span>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 sm:p-5">
                <span className="text-xs text-muted-foreground block">
                  {t('workLog.history.balance')}
                </span>
                <span
                  className={`text-2xl font-bold font-mono mt-1 block ${
                    monthSummary.diff.isBalanced
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : monthSummary.diff.isOver
                      ? 'text-sky-600 dark:text-sky-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {monthSummary.diff.formatted}
                </span>
                <span className="text-xs text-muted-foreground mt-1 block">
                  Net variance against shift expectations
                </span>
              </CardContent>
            </Card>
          </div>

          {/* CALENDAR VIEW */}
          {viewMode === 'calendar' && (
            <Card>
              <CardContent className="p-3 sm:p-6">
                <div className="overflow-x-auto">
                  <div className="min-w-[640px]">
                    {/* Day Headers */}
                    <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-semibold text-muted-foreground">
                      <div>Sun</div>
                      <div>Mon</div>
                      <div>Tue</div>
                      <div>Wed</div>
                      <div>Thu</div>
                      <div>Fri</div>
                      <div>Sat</div>
                    </div>

                    {/* Day Cells Grid */}
                    <div className="grid grid-cols-7 gap-2">
                      {calendarDays.map((cell, idx) => {
                        if (!cell.inMonth) {
                          return (
                            <div
                              key={idx}
                              className="h-24 rounded-lg bg-muted/20 border border-transparent"
                            />
                          );
                        }

                        const log = cell.log;
                        const hasLog = !!log;
                        const totalHours = log
                          ? (log.entries || []).reduce((acc, e) => acc + e.hours, 0)
                          : 0;
                        const isToday = cell.dateStr === todayStr;

                        return (
                          <div
                            key={idx}
                            onClick={() => handleOpenDay(cell.dateStr)}
                            className={`h-24 rounded-lg p-2 border flex flex-col justify-between transition-all cursor-pointer hover:border-primary hover:shadow-sm ${
                              isToday
                                ? 'bg-primary/5 border-primary/40'
                                : hasLog
                                ? 'bg-card border-border'
                                : 'bg-muted/10 border-border/40 hover:bg-muted/20'
                            }`}
                            title={`Click to open ${cell.dateStr}`}
                          >
                            <div className="flex items-center justify-between">
                              <span
                                className={`text-xs font-bold ${
                                  isToday ? 'text-primary' : 'text-foreground'
                                }`}
                              >
                                {cell.dayNumber}
                              </span>
                              {hasLog && (
                                <WorkLogStatusBadge status={log.status} showDotOnly />
                              )}
                            </div>

                            {hasLog ? (
                              <div className="space-y-1">
                                <div className="text-xs font-mono font-semibold text-primary truncate">
                                  {totalHours.toFixed(2)}h
                                </div>
                                <div className="text-[10px] text-muted-foreground capitalize truncate">
                                  {log.status}
                                </div>
                              </div>
                            ) : (
                              <span className="text-[10px] text-muted-foreground/60 italic">
                                —
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* LIST VIEW */}
          {viewMode === 'list' && (
            <Card>
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base font-semibold">
                  {monthNames[currentMonth - 1]} {currentYear} — Recorded Work Logs
                </CardTitle>
                <CardDescription className="text-xs">
                  {monthLogs.length} work log days recorded
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {monthLogs.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    {t('workLog.history.noLogsInMonth')}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground text-xs font-medium text-left bg-muted/20">
                          <th className="py-2.5 px-4">{t('workLog.history.dateColumn')}</th>
                          <th className="py-2.5 px-4">{t('workLog.history.statusColumn')}</th>
                          <th className="py-2.5 px-4">{t('workLog.history.hoursColumn')}</th>
                          <th className="py-2.5 px-4">{t('workLog.history.entriesCountColumn')}</th>
                          <th className="py-2.5 px-4 text-right"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {monthLogs.map((log) => {
                          const dateStr = log.date.split('T')[0];
                          const totalHours = (log.entries || []).reduce(
                            (acc, e) => acc + e.hours,
                            0
                          );

                          return (
                            <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                              <td className="py-3 px-4 font-medium">
                                {formatDateDisplay(dateStr)}
                              </td>
                              <td className="py-3 px-4">
                                <WorkLogStatusBadge status={log.status} />
                              </td>
                              <td className="py-3 px-4 font-mono font-semibold">
                                {totalHours.toFixed(2)}h
                              </td>
                              <td className="py-3 px-4 text-muted-foreground">
                                {log.entries?.length ?? 0} entries
                              </td>
                              <td className="py-3 px-4 text-right">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenDay(dateStr)}
                                  className="h-8 gap-1.5 text-xs"
                                >
                                  <span>{t('workLog.history.openDay')}</span>
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Work Role Distribution (Monthly) */}
          {monthSummary.rolesBreakdown.length > 0 && (
            <Card>
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-muted-foreground" />
                  <CardTitle className="text-base font-semibold">
                    {t('workLog.history.totalsByRole')} ({monthNames[currentMonth - 1]} {currentYear})
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {monthSummary.rolesBreakdown.map((item, idx) => {
                    const pct =
                      monthSummary.totalHours > 0
                        ? Math.round((item.hours / monthSummary.totalHours) * 100)
                        : 0;

                    return (
                      <div
                        key={idx}
                        className="border rounded-lg p-3 bg-card/60 space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold truncate">{item.roleName}</span>
                          <span className="text-muted-foreground font-mono">{pct}%</span>
                        </div>
                        <div className="text-lg font-bold font-mono text-primary">
                          {item.hours.toFixed(2)}h
                        </div>
                        {/* Progress Bar */}
                        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-primary h-1.5 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* WEEK VIEW SECTION */}
      {activeTab === 'week' && (
        <div className="space-y-6">
          {/* Week Selector Card */}
          <Card>
            <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <Label htmlFor="week-start-date" className="text-sm font-semibold">
                  {t('workLog.history.selectWeekStart')}:
                </Label>
                <Input
                  id="week-start-date"
                  type="date"
                  value={weekStartDate}
                  onChange={(e) => setWeekStartDate(e.target.value)}
                  className="w-full sm:w-auto"
                />
                <span className="text-xs text-muted-foreground">
                  7-day span from {formatDateDisplay(weekStartDate)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setWeekStartDate(addDays(weekStartDate, -7))}
                >
                  Previous Week
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setWeekStartDate(getWeekMonday(todayStr))}
                >
                  Current Week
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setWeekStartDate(addDays(weekStartDate, 7))}
                >
                  Next Week
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => refetchWeek()}
                  className="h-8 w-8 p-0"
                  disabled={isLoadingWeek}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingWeek ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Weekly Summary Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 sm:p-5">
                <span className="text-xs text-muted-foreground block">
                  {t('workLog.history.overallTotal')}
                </span>
                <span className="text-2xl font-bold font-mono text-primary mt-1 block">
                  {weekSummary.totalHours.toFixed(2)}h
                </span>
                <span className="text-xs text-muted-foreground mt-1 block">
                  Logged across the 7-day period
                </span>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 sm:p-5">
                <span className="text-xs text-muted-foreground block">
                  {t('workLog.history.expectedTotal')}
                </span>
                <span className="text-2xl font-bold font-mono mt-1 block">
                  {weekSummary.expectedHours.toFixed(2)}h
                </span>
                <span className="text-xs text-muted-foreground mt-1 block">
                  Standard 5-day shift baseline
                </span>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 sm:p-5">
                <span className="text-xs text-muted-foreground block">
                  {t('workLog.history.balance')}
                </span>
                <span
                  className={`text-2xl font-bold font-mono mt-1 block ${
                    weekSummary.diff.isBalanced
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : weekSummary.diff.isOver
                      ? 'text-sky-600 dark:text-sky-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {weekSummary.diff.formatted}
                </span>
                <span className="text-xs text-muted-foreground mt-1 block">
                  Week shift variance
                </span>
              </CardContent>
            </Card>
          </div>

          {/* Daily Breakdown for Week */}
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base font-semibold">
                {t('workLog.history.totalsByDay')}
              </CardTitle>
              <CardDescription className="text-xs">
                {t('workLog.history.weekSummarySubtitle')}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground text-xs font-medium text-left bg-muted/20">
                      <th className="py-2.5 px-4">{t('workLog.history.dateColumn')}</th>
                      <th className="py-2.5 px-4">{t('workLog.history.statusColumn')}</th>
                      <th className="py-2.5 px-4">{t('workLog.history.hoursColumn')}</th>
                      <th className="py-2.5 px-4 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {weekSummary.weekDays.map((day) => (
                      <tr key={day.dateStr} className="hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-4 font-medium">
                          {formatDateDisplay(day.dateStr)}
                        </td>
                        <td className="py-3 px-4">
                          <WorkLogStatusBadge status={day.status} />
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold">
                          {day.totalHours > 0 ? `${day.totalHours.toFixed(2)}h` : '—'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenDay(day.dateStr)}
                            className="h-8 gap-1.5 text-xs"
                          >
                            <span>{t('workLog.history.openDay')}</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Week Work Role Distribution */}
          {weekSummary.rolesBreakdown.length > 0 && (
            <Card>
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-muted-foreground" />
                  <CardTitle className="text-base font-semibold">
                    {t('workLog.history.totalsByRole')} (7-Day Span)
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {weekSummary.rolesBreakdown.map((item, idx) => {
                    const pct =
                      weekSummary.totalHours > 0
                        ? Math.round((item.hours / weekSummary.totalHours) * 100)
                        : 0;

                    return (
                      <div
                        key={idx}
                        className="border rounded-lg p-3 bg-card/60 space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold truncate">{item.roleName}</span>
                          <span className="text-muted-foreground font-mono">{pct}%</span>
                        </div>
                        <div className="text-lg font-bold font-mono text-primary">
                          {item.hours.toFixed(2)}h
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-primary h-1.5 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
