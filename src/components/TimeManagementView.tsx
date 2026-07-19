import { useState, useEffect, useMemo, FormEvent } from 'react';
import { 
  Project, 
  Task, 
  AppSettings,
  TimeLog,
  CalendarEvent
} from '../types';
import { 
  Clock, 
  Calendar as CalendarIcon, 
  Play, 
  Square, 
  Plus, 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  User, 
  Briefcase, 
  CheckCircle, 
  FileText, 
  Activity, 
  Info,
  Tag,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { formatDate } from '../utils';

interface TimeManagementViewProps {
  projects: Project[];
  tasks: Task[];
  settings: AppSettings;
  userUid: string;
}

export default function TimeManagementView({ 
  projects, 
  tasks, 
  settings, 
  userUid 
}: TimeManagementViewProps) {
  // Sub-tabs: 'tracker' (Zaman takibi) | 'calendar' (İş takip takvimi)
  const [subTab, setSubTab] = useState<'tracker' | 'calendar'>('tracker');

  // Firestore state
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);

  // Subscriptions to Firestore data
  useEffect(() => {
    if (!userUid) return;

    // Listen to time logs
    const qLogs = query(collection(db, 'timeLogs'), where('userId', '==', userUid));
    const unsubscribeLogs = onSnapshot(qLogs, (snapshot) => {
      const logs: TimeLog[] = [];
      snapshot.forEach((docSnap) => {
        logs.push(docSnap.data() as TimeLog);
      });
      // Sort: active/running first, then descending by startTime
      logs.sort((a, b) => {
        if (!a.endTime && b.endTime) return -1;
        if (a.endTime && !b.endTime) return 1;
        return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
      });
      setTimeLogs(logs);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'timeLogs');
    });

    // Listen to calendar events
    const qEvents = query(collection(db, 'calendarEvents'), where('userId', '==', userUid));
    const unsubscribeEvents = onSnapshot(qEvents, (snapshot) => {
      const events: CalendarEvent[] = [];
      snapshot.forEach((docSnap) => {
        events.push(docSnap.data() as CalendarEvent);
      });
      setCalendarEvents(events);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'calendarEvents');
    });

    return () => {
      unsubscribeLogs();
      unsubscribeEvents();
    };
  }, [userUid]);

  // Language helper
  const t = (en: string, tr: string, pl: string) => {
    if (settings.lang === 'tr') return tr;
    if (settings.lang === 'pl') return pl;
    return en;
  };

  // --- SUB-TAB 1: CLOCK-IN/OUT TRACKER STATE & ACTIONS ---
  const activeLog = useMemo(() => timeLogs.find(log => !log.endTime), [timeLogs]);
  const [trackerProject, setTrackerProject] = useState<string>('');
  const [trackerTask, setTrackerTask] = useState<string>('');
  const [trackerNotes, setTrackerNotes] = useState<string>('');
  const [manualLogProject, setManualLogProject] = useState<string>('');
  const [manualLogTask, setManualLogTask] = useState<string>('');
  const [manualLogDate, setManualLogDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [manualLogStart, setManualLogStart] = useState<string>('09:00');
  const [manualLogEnd, setManualLogEnd] = useState<string>('17:00');
  const [manualLogNotes, setManualLogNotes] = useState<string>('');
  const [showManualLogForm, setShowManualLogForm] = useState<boolean>(false);

  // Active running duration state
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  useEffect(() => {
    let interval: any = null;
    if (activeLog) {
      const calculateElapsed = () => {
        const start = new Date(activeLog.startTime).getTime();
        const now = Date.now();
        setElapsedSeconds(Math.max(0, Math.floor((now - start) / 1000)));
      };
      calculateElapsed();
      interval = setInterval(calculateElapsed, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeLog]);

  // Project tasks filter helper
  const availableTasksForSelectedProject = useMemo(() => {
    const selectedProjId = activeLog ? activeLog.projectId : trackerProject;
    return tasks.filter(task => task.projectId === selectedProjId);
  }, [tasks, trackerProject, activeLog]);

  // Project tasks filter helper for manual log
  const manualLogAvailableTasks = useMemo(() => {
    return tasks.filter(task => task.projectId === manualLogProject);
  }, [tasks, manualLogProject]);

  const handleClockIn = async () => {
    if (!trackerProject) return;
    const logId = `log-${Date.now()}`;
    const newLog: TimeLog = {
      id: logId,
      userId: userUid,
      projectId: trackerProject,
      startTime: new Date().toISOString(),
      notes: trackerNotes
    };
    if (trackerTask) {
      newLog.taskId = trackerTask;
    }
    try {
      await setDoc(doc(db, 'timeLogs', logId), newLog);
      // Reset forms
      setTrackerTask('');
      setTrackerNotes('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `timeLogs/${logId}`);
    }
  };

  const handleClockOut = async () => {
    if (!activeLog) return;
    const now = new Date();
    const start = new Date(activeLog.startTime);
    const durationMinutes = Math.max(1, Math.floor((now.getTime() - start.getTime()) / 60000));

    const updatedLog: TimeLog = {
      ...activeLog,
      endTime: now.toISOString(),
      notes: trackerNotes || activeLog.notes || '',
      durationMinutes
    };

    try {
      await setDoc(doc(db, 'timeLogs', activeLog.id), updatedLog);
      setTrackerNotes('');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `timeLogs/${activeLog.id}`);
    }
  };

  const handleAddManualLog = async (e: FormEvent) => {
    e.preventDefault();
    if (!manualLogProject || !manualLogDate || !manualLogStart || !manualLogEnd) return;

    const startTimeStr = `${manualLogDate}T${manualLogStart}:00`;
    const endTimeStr = `${manualLogDate}T${manualLogEnd}:00`;
    const start = new Date(startTimeStr);
    const end = new Date(endTimeStr);

    if (end.getTime() <= start.getTime()) {
      alert(t('End time must be after start time!', 'Bitiş saati başlangıç saatinden sonra olmalıdır!', 'Czas zakończenia musi być po czasie rozpoczęcia!'));
      return;
    }

    const durationMinutes = Math.floor((end.getTime() - start.getTime()) / 60000);
    const logId = `log-${Date.now()}`;
    const newLog: TimeLog = {
      id: logId,
      userId: userUid,
      projectId: manualLogProject,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      durationMinutes,
      notes: manualLogNotes
    };

    if (manualLogTask) {
      newLog.taskId = manualLogTask;
    }

    try {
      await setDoc(doc(db, 'timeLogs', logId), newLog);
      // Reset
      setManualLogProject('');
      setManualLogTask('');
      setManualLogNotes('');
      setShowManualLogForm(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `timeLogs/${logId}`);
    }
  };

  const handleDeleteLog = async (id: string) => {
    if (!confirm(t('Are you sure you want to delete this time log?', 'Bu zaman kaydını silmek istediğinize emin misiniz?', 'Czy na pewno chcesz usunąć ten wpis czasu?'))) return;
    try {
      await deleteDoc(doc(db, 'timeLogs', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `timeLogs/${id}`);
    }
  };

  // Helper to format total duration minutes as "H:MM" or similar
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) {
      return `${mins} ${t('min', 'dk', 'min')}`;
    }
    return `${hours} ${t('hr', 'saat', 'godz')} ${mins} ${t('min', 'dk', 'min')}`;
  };

  const formatElapsedTime = (sec: number) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;
    return [hrs, mins, secs].map(v => String(v).padStart(2, '0')).join(':');
  };

  // --- SUB-TAB 2: CALENDAR WORK SCHEDULE STATE & ACTIONS ---
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDayStr, setSelectedDayStr] = useState<string>(new Date().toISOString().split('T')[0]);
  const [showEventForm, setShowEventForm] = useState<boolean>(false);

  // New Event Form fields
  const [eventProject, setEventProject] = useState<string>('');
  const [eventTitle, setEventTitle] = useState<string>('');
  const [eventDesc, setEventDesc] = useState<string>('');
  const [eventStartDay, setEventStartDay] = useState<string>(selectedDayStr);
  const [eventEndDay, setEventEndDay] = useState<string>(selectedDayStr);
  const [eventStartTime, setEventStartTime] = useState<string>('09:00');
  const [eventEndTime, setEventEndTime] = useState<string>('10:00');
  const [eventColor, setEventColor] = useState<string>('bg-blue-500');

  // Colors mapping for styling
  const colorOptions = [
    { value: 'bg-blue-500', name: t('Blue', 'Mavi', 'Niebieski'), text: 'text-blue-500' },
    { value: 'bg-emerald-500', name: t('Green', 'Yeşil', 'Zielony'), text: 'text-emerald-500' },
    { value: 'bg-amber-500', name: t('Orange', 'Turuncu', 'Pomarańczowy'), text: 'text-amber-500' },
    { value: 'bg-purple-500', name: t('Purple', 'Mor', 'Fioletowy'), text: 'text-purple-500' },
    { value: 'bg-rose-500', name: t('Red', 'Kırmızı', 'Czerwony'), text: 'text-rose-500' },
  ];

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleDaySelect = (dayStr: string) => {
    setSelectedDayStr(dayStr);
    setEventStartDay(dayStr);
    setEventEndDay(dayStr);
  };

  const handleAddEvent = async (e: FormEvent) => {
    e.preventDefault();
    if (!eventTitle || !eventStartDay || !eventEndDay) return;

    const eventId = `event-${Date.now()}`;
    const newEvent: CalendarEvent = {
      id: eventId,
      userId: userUid,
      projectId: eventProject || 'none',
      title: eventTitle,
      description: eventDesc,
      startDate: eventStartDay,
      endDate: eventEndDay,
      color: eventColor
    };

    if (eventStartTime) newEvent.startTime = eventStartTime;
    if (eventEndTime) newEvent.endTime = eventEndTime;

    try {
      await setDoc(doc(db, 'calendarEvents', eventId), newEvent);
      setEventTitle('');
      setEventDesc('');
      setEventProject('');
      setShowEventForm(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `calendarEvents/${eventId}`);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!confirm(t('Are you sure you want to delete this event?', 'Bu iş programını silmek istediğinize emin misiniz?', 'Czy na pewno chcesz usunąć to wydarzenie?'))) return;
    try {
      await deleteDoc(doc(db, 'calendarEvents', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `calendarEvents/${id}`);
    }
  };

  // Calendar render math
  const daysInMonth = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const totalDays = new Date(year, month + 1, 0).getDate();
    // Weekday of the first day (0 = Sunday, 1 = Monday...)
    // Let's adjust to make Monday = 0
    let firstDayIndex = new Date(year, month, 1).getDay();
    firstDayIndex = firstDayIndex === 0 ? 6 : firstDayIndex - 1; // shift Sunday to 6, Monday to 0

    const arr: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

    // Prev month padding
    const prevMonthTotalDays = new Date(year, month, 0).getDate();
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const prevDate = new Date(year, month - 1, prevMonthTotalDays - i);
      const str = prevDate.toISOString().split('T')[0];
      arr.push({ dateStr: str, dayNum: prevMonthTotalDays - i, isCurrentMonth: false });
    }

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      const currDate = new Date(year, month, i);
      const str = currDate.toISOString().split('T')[0];
      arr.push({ dateStr: str, dayNum: i, isCurrentMonth: true });
    }

    // Next month padding to fill grid (multiple of 7)
    const remaining = 42 - arr.length; // 6 rows of 7 days = 42
    for (let i = 1; i <= remaining; i++) {
      const nextDate = new Date(year, month + 1, i);
      const str = nextDate.toISOString().split('T')[0];
      arr.push({ dateStr: str, dayNum: i, isCurrentMonth: false });
    }

    return arr;
  }, [currentDate]);

  // Map events to dates for easy lookup
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    calendarEvents.forEach(evt => {
      // If it spans multiple days
      const start = new Date(evt.startDate);
      const end = new Date(evt.endDate);
      const temp = new Date(start);

      while (temp <= end) {
        const dStr = temp.toISOString().split('T')[0];
        if (!map[dStr]) map[dStr] = [];
        map[dStr].push(evt);
        temp.setDate(temp.getDate() + 1);
      }
    });
    return map;
  }, [calendarEvents]);

  // Selected Day Events
  const selectedDayEvents = useMemo(() => {
    return eventsByDate[selectedDayStr] || [];
  }, [eventsByDate, selectedDayStr]);

  // Month names translation
  const monthNames = [
    t('January', 'Ocak', 'Styczeń'),
    t('February', 'Şubat', 'Luty'),
    t('March', 'Mart', 'Marzec'),
    t('April', 'Nisan', 'Kwiecień'),
    t('May', 'Mayıs', 'Maj'),
    t('June', 'Haziran', 'Czerwiec'),
    t('July', 'Temmuz', 'Lipiec'),
    t('August', 'Ağustos', 'Sierpień'),
    t('September', 'Eylül', 'Wrzesień'),
    t('October', 'Ekim', 'Październik'),
    t('November', 'Kasım', 'Listopad'),
    t('December', 'Aralık', 'Grudzień')
  ];

  // Tracker summaries today, week, month
  const trackerStats = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    // Start of week
    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);

    // Start of month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let todayMins = 0;
    let weekMins = 0;
    let monthMins = 0;

    timeLogs.forEach(log => {
      if (log.endTime && log.durationMinutes) {
        const logDate = new Date(log.startTime);
        const logDateStr = log.startTime.split('T')[0];

        if (logDateStr === todayStr) {
          todayMins += log.durationMinutes;
        }
        if (logDate >= startOfWeek) {
          weekMins += log.durationMinutes;
        }
        if (logDate >= startOfMonth) {
          monthMins += log.durationMinutes;
        }
      }
    });

    return { todayMins, weekMins, monthMins };
  }, [timeLogs]);

  return (
    <div className="space-y-6">
      
      {/* HEADER SECTION */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            {t('Time & Job Management', 'Zaman ve İş Yönetimi', 'Zarządzanie Czasem i Pracą')}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t('Track work sessions, log task duration and coordinate project schedules.', 'Çalışma saatlerinizi ölçün, usta giriş-çıkış takibi yapın ve iş programı planlayın.', 'Śledź sesje pracy, rejestruj czas zadań i koordynuj harmonogramy projektów.')}
          </p>
        </div>

        {/* PILL TABS SELECTION */}
        <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200/50 dark:border-slate-800">
          <button
            onClick={() => setSubTab('tracker')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              subTab === 'tracker'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            {t('Time Tracker', 'Zaman Takibi', 'Licznik Czasu')}
          </button>
          <button
            onClick={() => setSubTab('calendar')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              subTab === 'calendar'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            {t('Work Schedule', 'İş Takip Takvimi', 'Harmonogram Pracy')}
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={subTab}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          transition={{ duration: 0.15 }}
        >
          {subTab === 'tracker' ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* CLOCK IN/OUT & STATS WORKSPACE */}
              <div className="lg:col-span-1 space-y-6">
                
                {/* ACTIVE TRACKER ENGINE CARD */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
                  <div className="border-b border-slate-150 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-5 py-4 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-450 dark:text-slate-400 flex items-center gap-2">
                      <Activity className={`w-3.5 h-3.5 ${activeLog ? 'text-red-500 animate-pulse' : 'text-slate-400'}`} />
                      {activeLog ? t('SESSION ACTIVE', 'ÖLÇÜM SÜRÜYOR', 'SESJA AKTYWNA') : t('START TRACKING', 'YENİ KAYIT BAŞLAT', 'ROZPOCZNIJ')}
                    </span>
                    {activeLog && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 dark:bg-red-950/35 text-red-600 dark:text-red-450 animate-pulse">
                        ● Live
                      </span>
                    )}
                  </div>

                  <div className="p-6 space-y-5">
                    {activeLog ? (
                      // ACTIVE CLOCKED-IN DISPLAY
                      <div className="space-y-5 text-center">
                        <div className="text-4xl font-mono font-bold text-slate-850 dark:text-white py-4 tracking-tight">
                          {formatElapsedTime(elapsedSeconds)}
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-850 space-y-2.5 text-left">
                          <div className="flex items-start gap-2">
                            <Briefcase className="w-4 h-4 text-slate-400 mt-0.5" />
                            <div>
                              <div className="text-[10px] text-slate-400 font-bold uppercase">{t('PROJECT / CLIENT', 'PROJE / MÜŞTERİ', 'PROJEKT / KLIENT')}</div>
                              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                {projects.find(p => p.id === activeLog.projectId)?.name || t('Unknown Project', 'Bilinmeyen Proje', 'Nieznany Projekt')}
                              </div>
                            </div>
                          </div>

                          {activeLog.taskId && (
                            <div className="flex items-start gap-2 pt-2 border-t border-slate-150 dark:border-slate-800">
                              <CheckCircle className="w-4 h-4 text-slate-400 mt-0.5" />
                              <div>
                                <div className="text-[10px] text-slate-400 font-bold uppercase">{t('TASK', 'HEDEF GÖREV', 'ZADANIE')}</div>
                                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                  {tasks.find(t => t.id === activeLog.taskId)?.title || t('Unknown Task', 'Bilinmeyen Görev', 'Nieznane Zadanie')}
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="flex items-start gap-2 pt-2 border-t border-slate-150 dark:border-slate-800">
                            <Clock className="w-4 h-4 text-slate-400 mt-0.5" />
                            <div>
                              <div className="text-[10px] text-slate-400 font-bold uppercase">{t('STARTED AT', 'GİRİŞ SAATİ', 'ZALOGOWANO O')}</div>
                              <div className="text-xs font-semibold text-slate-850 dark:text-slate-300">
                                {new Date(activeLog.startTime).toLocaleTimeString(settings.lang === 'tr' ? 'tr-TR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Note area for clock out */}
                        <div className="text-left space-y-1.5">
                          <label className="text-[11px] font-bold text-slate-400 uppercase">{t('Work Notes', 'Çalışma / Yapılan İş Notu', 'Notatki z pracy')}</label>
                          <textarea
                            value={trackerNotes}
                            onChange={(e) => setTrackerNotes(e.target.value)}
                            placeholder={t('Describe what you accomplished...', 'Bu süre içerisinde neler yapıldığını buraya not edebilirsiniz...', 'Opisz co zostało zrobione...')}
                            className="w-full text-xs p-3 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-slate-950 dark:text-slate-200 resize-none h-20"
                          />
                        </div>

                        <button
                          onClick={handleClockOut}
                          className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-3 px-4 rounded-xl cursor-pointer shadow-sm hover:shadow-md transition-all duration-200"
                        >
                          <Square className="w-4 h-4 fill-current" />
                          {t('CLOCK OUT & STOP', 'ÇIKIŞ YAP / BİTİR', 'WYLOGUJ I ZAKOŃCZ')}
                        </button>
                      </div>
                    ) : (
                      // INACTIVE CLOCK-IN PREPARATION
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-slate-400 uppercase">{t('Select Project', 'Proje Seçimi', 'Wybierz Projekt')}</label>
                          <select
                            value={trackerProject}
                            onChange={(e) => {
                              setTrackerProject(e.target.value);
                              setTrackerTask('');
                            }}
                            className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-slate-950 dark:text-slate-200"
                          >
                            <option value="">{t('-- Choose Project --', '-- Proje Seçiniz --', '-- Wybierz Projekt --')}</option>
                            {projects.map((proj) => (
                              <option key={proj.id} value={proj.id}>{proj.name}</option>
                            ))}
                          </select>
                        </div>

                        {trackerProject && (
                          <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-400 uppercase">{t('Select Task (Optional)', 'Görev İlişkisi (İsteğe Bağlı)', 'Wybierz Zadanie (Opcjonalnie)')}</label>
                            <select
                              value={trackerTask}
                              onChange={(e) => setTrackerTask(e.target.value)}
                              className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-slate-950 dark:text-slate-200"
                            >
                              <option value="">{t('-- No Specific Task --', '-- Belirli Bir Görev Yok --', '-- Brak Konkretnego Zadania --')}</option>
                              {availableTasksForSelectedProject.map((task) => (
                                <option key={task.id} value={task.id}>{task.title}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-slate-400 uppercase">{t('Initial Note', 'Giriş Notu', 'Notatka Początkowa')}</label>
                          <textarea
                            value={trackerNotes}
                            onChange={(e) => setTrackerNotes(e.target.value)}
                            placeholder={t('Optional notes to start...', 'İsteğe bağlı başlangıç notları...', 'Opcjonalne notatki...')}
                            className="w-full text-xs p-3 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-slate-950 dark:text-slate-200 resize-none h-16"
                          />
                        </div>

                        <button
                          onClick={handleClockIn}
                          disabled={!trackerProject}
                          className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-100 disabled:dark:bg-slate-800 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-xs font-bold py-3 px-4 rounded-xl cursor-pointer shadow-sm hover:shadow-md transition-all duration-200"
                        >
                          <Play className="w-4 h-4 fill-current" />
                          {t('CLOCK IN / START', 'İŞE GİRİŞ YAP / BAŞLAT', 'WEJDŹ / ROZPOCZNIJ')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* TRACKER STATS CARDS */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 space-y-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                    <Info className="w-4 h-4" />
                    {t('WORK TIME SUMMARY', 'SÜRE ÖZETLERİ', 'PODSUMOWANIE CZASU')}
                  </span>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-100 dark:border-slate-850 text-center">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">{t('Today', 'Bugün', 'Dziś')}</div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">
                        {formatDuration(trackerStats.todayMins)}
                      </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-100 dark:border-slate-850 text-center">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">{t('This Week', 'Bu Hafta', 'W tym tygodniu')}</div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">
                        {formatDuration(trackerStats.weekMins)}
                      </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-100 dark:border-slate-850 text-center">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">{t('This Month', 'Bu Ay', 'W tym miesiącu')}</div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">
                        {formatDuration(trackerStats.monthMins)}
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* TRACKER HISTORY & MANUAL ENTRY FORM */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* MANUAL LOG TRIGGER AND FORM */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                  <div className="p-5 flex justify-between items-center border-b border-slate-150 dark:border-slate-800">
                    <div>
                      <h3 className="text-sm font-bold text-slate-850 dark:text-white">
                        {t('Time Logs History', 'Giriş-Çıkış Geçmişi & Zaman Kayıtları', 'Historia wpisów czasu')}
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {t('Manage tracked worker hours and manually add missed sessions.', 'Personel çalışma saatlerini yönetin ve unutulan zamanları elle ekleyin.', 'Zarządzaj godzinami pracy i dodaj pominięte sesje.')}
                      </p>
                    </div>
                    
                    <button
                      onClick={() => setShowManualLogForm(!showManualLogForm)}
                      className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/45 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {showManualLogForm ? t('Cancel', 'İptal Et', 'Anuluj') : t('Add Forgot Time', 'Geçmiş Zaman Ekle', 'Dodaj wpis')}
                    </button>
                  </div>

                  <AnimatePresence>
                    {showManualLogForm && (
                      <motion.form 
                        onSubmit={handleAddManualLog}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="p-5 bg-slate-50 dark:bg-slate-950 border-b border-slate-150 dark:border-slate-800 overflow-hidden space-y-4 text-xs"
                      >
                        <div className="text-xs font-bold text-slate-550 dark:text-slate-300 uppercase flex items-center gap-1.5">
                          <Plus className="w-4 h-4 text-blue-500" />
                          {t('MANUAL TIME LOG ENTRY', 'ELLE MANUEL GİRİŞ EKLEME', 'RĘCZNE DODAWANIE WPISU')}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">{t('Project', 'Proje', 'Projekt')}</label>
                            <select
                              required
                              value={manualLogProject}
                              onChange={(e) => {
                                setManualLogProject(e.target.value);
                                setManualLogTask('');
                              }}
                              className="w-full text-xs p-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 dark:text-slate-200"
                            >
                              <option value="">{t('-- Choose Project --', '-- Proje Seçiniz --', '-- Wybierz Projekt --')}</option>
                              {projects.map((p) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">{t('Task (Optional)', 'İlgili Görev (İsteğe Bağlı)', 'Zadanie (Opcjonalnie)')}</label>
                            <select
                              value={manualLogTask}
                              onChange={(e) => setManualLogTask(e.target.value)}
                              className="w-full text-xs p-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 dark:text-slate-200"
                            >
                              <option value="">{t('-- No Specific Task --', '-- Belirli Bir Görev Yok --', '-- Brak Konkretnego Zadania --')}</option>
                              {manualLogAvailableTasks.map((t) => (
                                <option key={t.id} value={t.id}>{t.title}</option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">{t('Date', 'Tarih', 'Data')}</label>
                            <input
                              type="date"
                              required
                              value={manualLogDate}
                              onChange={(e) => setManualLogDate(e.target.value)}
                              className="w-full text-xs p-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 dark:text-slate-200"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase">{t('Start Hour', 'Giriş Saati', 'Wejście')}</label>
                              <input
                                type="time"
                                required
                                value={manualLogStart}
                                onChange={(e) => setManualLogStart(e.target.value)}
                                className="w-full text-xs p-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 dark:text-slate-200"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase">{t('End Hour', 'Çıkış Saati', 'Wyjście')}</label>
                              <input
                                type="time"
                                required
                                value={manualLogEnd}
                                onChange={(e) => setManualLogEnd(e.target.value)}
                                className="w-full text-xs p-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 dark:text-slate-200"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">{t('Work Description', 'Yapılan İşle Alakalı Açıklama / Notlar', 'Opis Pracy / Notatki')}</label>
                          <input
                            type="text"
                            value={manualLogNotes}
                            onChange={(e) => setManualLogNotes(e.target.value)}
                            placeholder={t('Explain details about materials, worker groups or milestones done...', 'Yapılan harç, döşenen fayans, çalışan usta sayısı veya şantiye notu...', 'Wyjaśnij szczegóły wykonanych prac...')}
                            className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 dark:text-slate-200"
                          />
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => setShowManualLogForm(false)}
                            className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 cursor-pointer font-semibold text-xs"
                          >
                            {t('Cancel', 'İptal', 'Anuluj')}
                          </button>
                          <button
                            type="submit"
                            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white cursor-pointer font-bold text-xs"
                          >
                            {t('Save Log', 'Zamanı Kaydet', 'Zapisz')}
                          </button>
                        </div>
                      </motion.form>
                    )}
                  </AnimatePresence>

                  {/* HISTORY TABLE LIST */}
                  <div className="p-5">
                    {timeLogs.length === 0 ? (
                      <div className="text-center py-10 space-y-2">
                        <Clock className="w-8 h-8 text-slate-300 mx-auto" />
                        <div className="text-xs font-semibold text-slate-500">{t('No time logs recorded yet.', 'Henüz kaydedilmiş zaman kaydı bulunmuyor.', 'Nie zarejestrowano jeszcze żadnych wpisów czasu.')}</div>
                        <div className="text-[11px] text-slate-400">{t('Clock in or add manual logs to start calculations.', 'Hesaplamalara başlamak için giriş yapın veya manuel zaman ekleyin.', 'Wejdź lub dodaj wpis ręczny, aby rozpocząć obliczenia.')}</div>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-150 dark:border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                              <th className="pb-3">{t('Project & Task', 'Proje & Görev', 'Projekt i Zadanie')}</th>
                              <th className="pb-3">{t('Session Interval', 'Giriş-Çıkış Zamanı', 'Przedział Sesji')}</th>
                              <th className="pb-3">{t('Notes', 'Açıklama / Notlar', 'Notatki')}</th>
                              <th className="pb-3 text-right">{t('Duration', 'Toplam Süre', 'Czas Trwania')}</th>
                              <th className="pb-3 text-right"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {timeLogs.map((log) => {
                              const projName = projects.find(p => p.id === log.projectId)?.name || t('Unknown Project', 'Bilinmeyen Proje', 'Nieznany Projekt');
                              const taskTitle = tasks.find(t => t.id === log.taskId)?.title;
                              const start = new Date(log.startTime);
                              const end = log.endTime ? new Date(log.endTime) : null;
                              
                              return (
                                <tr key={log.id} className="border-b border-slate-100 dark:border-slate-800/40 hover:bg-slate-50/50 dark:hover:bg-slate-900/20">
                                  <td className="py-3.5 pr-2">
                                    <div className="font-semibold text-slate-800 dark:text-slate-200">{projName}</div>
                                    {taskTitle && (
                                      <div className="text-[10px] text-slate-450 dark:text-slate-450 flex items-center gap-1 mt-0.5">
                                        <Tag className="w-3 h-3 text-blue-500" />
                                        {taskTitle}
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-3.5">
                                    <div className="font-medium text-slate-700 dark:text-slate-350">
                                      {formatDate(log.startTime.split('T')[0], settings)}
                                    </div>
                                    <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                                      <span>{start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                      <span>→</span>
                                      {end ? (
                                        <span>{end.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                      ) : (
                                        <span className="text-red-500 font-bold animate-pulse">{t('Running', 'Devam Ediyor', 'Trwa')}</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-3.5 max-w-[200px] truncate" title={log.notes}>
                                    <span className="text-slate-500 dark:text-slate-400 text-xs italic">
                                      {log.notes || t('No description provided', 'Açıklama girilmemiş', 'Brak opisu')}
                                    </span>
                                  </td>
                                  <td className="py-3.5 text-right font-mono font-semibold text-slate-800 dark:text-slate-200 pr-2">
                                    {log.durationMinutes ? formatDuration(log.durationMinutes) : '-'}
                                  </td>
                                  <td className="py-3.5 text-right">
                                    <button
                                      onClick={() => handleDeleteLog(log.id)}
                                      className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1 rounded-lg transition-colors cursor-pointer"
                                      title={t('Delete Log', 'Kaydı Sil', 'Usuń Wpis')}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

              </div>

            </div>
          ) : (
            // --- SUB-TAB 2: CALENDAR SCHEDULER VIEW ---
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* INTERACTIVE CALENDAR MONTHLY GRID */}
              <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs p-6">
                
                {/* CALENDAR CONTROLS HEADER */}
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-1.5">
                    <CalendarIcon className="w-5 h-5 text-blue-600" />
                    <span className="text-lg font-bold text-slate-800 dark:text-white tracking-tight">
                      {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                    </span>
                  </div>

                  <div className="flex gap-1">
                    <button
                      onClick={handlePrevMonth}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-950 text-slate-600 dark:text-slate-300 cursor-pointer"
                      title={t('Prev Month', 'Önceki Ay', 'Poprzedni miesiąc')}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setCurrentDate(new Date())}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-950 text-slate-600 dark:text-slate-300 cursor-pointer"
                    >
                      {t('Today', 'Bugün', 'Dziś')}
                    </button>
                    <button
                      onClick={handleNextMonth}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-950 text-slate-600 dark:text-slate-300 cursor-pointer"
                      title={t('Next Month', 'Sonraki Ay', 'Następny miesiąc')}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* WEEKDAYS HEADERS */}
                <div className="grid grid-cols-7 gap-1.5 text-center mb-2">
                  {[
                    t('Mon', 'Pzt', 'Pon'),
                    t('Tue', 'Sal', 'Wt'),
                    t('Wed', 'Çar', 'Śr'),
                    t('Thu', 'Per', 'Czw'),
                    t('Fri', 'Cum', 'Pt'),
                    t('Sat', 'Cmt', 'Sob'),
                    t('Sun', 'Paz', 'Nie')
                  ].map((day, idx) => (
                    <div key={idx} className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider py-1">
                      {day}
                    </div>
                  ))}
                </div>

                {/* CALENDAR DAYS GRID */}
                <div className="grid grid-cols-7 gap-1.5">
                  {daysInMonth.map(({ dateStr, dayNum, isCurrentMonth }) => {
                    const hasSelected = selectedDayStr === dateStr;
                    const dayEvents = eventsByDate[dateStr] || [];
                    const isToday = new Date().toISOString().split('T')[0] === dateStr;

                    return (
                      <div
                        key={dateStr}
                        onClick={() => handleDaySelect(dateStr)}
                        className={`min-h-[85px] p-1.5 rounded-xl border flex flex-col justify-between transition-all cursor-pointer relative ${
                          hasSelected
                            ? 'border-blue-600 bg-blue-50/25 dark:bg-blue-950/20'
                            : 'border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-950'
                        } ${isCurrentMonth ? '' : 'opacity-40'}`}
                      >
                        {/* Day indicator badge */}
                        <div className="flex justify-between items-center">
                          <span className={`text-xs font-bold font-mono px-1.5 py-0.5 rounded-md ${
                            isToday 
                              ? 'bg-blue-600 text-white' 
                              : 'text-slate-700 dark:text-slate-300'
                          }`}>
                            {dayNum}
                          </span>
                          
                          {dayEvents.length > 0 && (
                            <span className="w-1.5 h-1.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
                          )}
                        </div>

                        {/* Event visual lines inside the calendar cell */}
                        <div className="mt-1 space-y-1 overflow-hidden flex-grow flex flex-col justify-end">
                          {dayEvents.slice(0, 2).map((evt) => (
                            <div
                              key={evt.id}
                              className={`text-[9px] font-semibold px-1 py-0.5 rounded-md text-white truncate max-w-full ${evt.color || 'bg-blue-500'}`}
                              title={evt.title}
                            >
                              {evt.title}
                            </div>
                          ))}
                          {dayEvents.length > 2 && (
                            <div className="text-[8px] font-bold text-slate-450 dark:text-slate-500 pl-1">
                              +{dayEvents.length - 2} {t('more', 'fazla', 'więcej')}
                            </div>
                          )}
                        </div>

                      </div>
                    );
                  })}
                </div>

              </div>

              {/* CALENDAR SCHEDULER SIDE BAR DETAILS */}
              <div className="lg:col-span-1 space-y-6">
                
                {/* EVENTS ON SELECTED DAY CARD */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                  <div className="border-b border-slate-150 dark:border-slate-800 px-5 py-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-450 dark:text-slate-400">
                        {t('DAY WORKPLAN', 'GÜNLÜK İŞ DETAYI', 'PLAN DNIA')}
                      </h3>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-100 mt-0.5">
                        {formatDate(selectedDayStr, settings)}
                      </div>
                    </div>

                    <button
                      onClick={() => setShowEventForm(!showEventForm)}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-lg cursor-pointer transition-all flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {showEventForm ? t('Close', 'Kapat', 'Zamknij') : t('Add Event', 'İş Ekle', 'Zaplanuj')}
                    </button>
                  </div>

                  <div className="p-5 space-y-4">
                    
                    {/* ADD EVENT INLINE FORM */}
                    <AnimatePresence>
                      {showEventForm && (
                        <motion.form
                          onSubmit={handleAddEvent}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-150 dark:border-slate-850 overflow-hidden space-y-3.5 text-xs text-left"
                        >
                          <div className="text-[11px] font-bold text-slate-450 dark:text-slate-300 uppercase flex items-center gap-1">
                            <Plus className="w-3.5 h-3.5 text-blue-500" />
                            {t('SCHEDULE NEW WORK', 'YENİ İŞ PROGRAMI KAYDI', 'PLANUJ NOWĄ PRACĘ')}
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">{t('Project / Client', 'Proje / Müşteri İlişkisi', 'Projekt / Klient')}</label>
                            <select
                              value={eventProject}
                              onChange={(e) => setEventProject(e.target.value)}
                              className="w-full text-xs p-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 dark:text-slate-200"
                            >
                              <option value="">{t('-- General Work (No Project) --', '-- Genel İş Programı (Projesiz) --', '-- Praca Ogólna (Bez Projektu) --')}</option>
                              {projects.map((proj) => (
                                <option key={proj.id} value={proj.id}>{proj.name}</option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">{t('Work / Event Title', 'İş Adı / Program Başlığı', 'Tytuł Wydarzenia')}</label>
                            <input
                              type="text"
                              required
                              value={eventTitle}
                              onChange={(e) => setEventTitle(e.target.value)}
                              placeholder={t('e.g., Pouring concrete, Site exploration...', 'Örn: Beton dökümü, Müşteri keşif ziyareti...', 'np. Wylewanie betonu...')}
                              className="w-full text-xs p-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 dark:text-slate-200"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase">{t('Start Date', 'Başlangıç Tarihi', 'Początek')}</label>
                              <input
                                type="date"
                                required
                                value={eventStartDay}
                                onChange={(e) => setEventStartDay(e.target.value)}
                                className="w-full text-xs p-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 dark:text-slate-200"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase">{t('End Date', 'Bitiş Tarihi', 'Koniec')}</label>
                              <input
                                type="date"
                                required
                                value={eventEndDay}
                                onChange={(e) => setEventEndDay(e.target.value)}
                                className="w-full text-xs p-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 dark:text-slate-200"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase">{t('Start Hour', 'Giriş Saati (Ops.)', 'Godz. Rozp. (Opc.)')}</label>
                              <input
                                type="time"
                                value={eventStartTime}
                                onChange={(e) => setEventStartTime(e.target.value)}
                                className="w-full text-xs p-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 dark:text-slate-200"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase">{t('End Hour', 'Çıkış Saati (Ops.)', 'Godz. Zak. (Opc.)')}</label>
                              <input
                                type="time"
                                value={eventEndTime}
                                onChange={(e) => setEventEndTime(e.target.value)}
                                className="w-full text-xs p-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 dark:text-slate-200"
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">{t('Description', 'İş Detayı / Not', 'Opis / Szczegóły')}</label>
                            <input
                              type="text"
                              value={eventDesc}
                              onChange={(e) => setEventDesc(e.target.value)}
                              placeholder={t('Optional description', 'İsteğe bağlı açıklama notları', 'Opcjonalne uwagi')}
                              className="w-full text-xs p-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 dark:text-slate-200"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">{t('Label Color', 'Renk Etiketi', 'Kolor Etykiety')}</label>
                            <div className="flex gap-2.5 pt-1">
                              {colorOptions.map((opt) => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => setEventColor(opt.value)}
                                  className={`w-6 h-6 rounded-full cursor-pointer transition-all ${opt.value} ${
                                    eventColor === opt.value ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' : ''
                                  }`}
                                  title={opt.name}
                                />
                              ))}
                            </div>
                          </div>

                          <div className="flex justify-end gap-2 pt-2">
                            <button
                              type="button"
                              onClick={() => setShowEventForm(false)}
                              className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-850 text-slate-550 dark:text-slate-450 cursor-pointer font-semibold text-[11px]"
                            >
                              {t('Cancel', 'İptal', 'Anuluj')}
                            </button>
                            <button
                              type="submit"
                              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white cursor-pointer font-bold text-[11px]"
                            >
                              {t('Save Event', 'Etkinliği Kaydet', 'Zapisz')}
                            </button>
                          </div>
                        </motion.form>
                      )}
                    </AnimatePresence>

                    {/* EVENT LISTS FOR SELECTED DAY */}
                    {selectedDayEvents.length === 0 ? (
                      <div className="text-center py-10 space-y-2 text-slate-400">
                        <CalendarIcon className="w-8 h-8 text-slate-300 mx-auto" />
                        <p className="text-xs font-semibold">{t('No jobs scheduled for this date.', 'Bu tarihte planlanmış bir iş bulunmuyor.', 'Brak zaplanowanych prac na ten dzień.')}</p>
                        <p className="text-[10px] text-slate-450">{t('Click "Add Event" to plan future activities or write reminders.', 'Gelecek faaliyetleri planlamak için "İş Ekle" tuşuna basın.', 'Kliknij "Zaplanuj", aby dodać wpis.')}</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedDayEvents.map((evt) => {
                          const proj = projects.find(p => p.id === evt.projectId);
                          
                          return (
                            <div
                              key={evt.id}
                              className="flex items-start justify-between p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-950/40 relative overflow-hidden"
                            >
                              <div className="flex gap-2.5 items-start">
                                {/* Color strip marker */}
                                <div className={`w-1.5 h-10 rounded-full ${evt.color || 'bg-blue-500'}`} />
                                <div>
                                  <h4 className="text-xs font-bold text-slate-850 dark:text-slate-100">{evt.title}</h4>
                                  
                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-450 dark:text-slate-450 mt-1">
                                    <span className="font-semibold text-slate-600 dark:text-slate-300">
                                      {proj ? proj.name : t('General Work', 'Genel Serbest İş', 'Prace Ogólne')}
                                    </span>
                                    {evt.startTime && (
                                      <>
                                        <span className="text-slate-300">|</span>
                                        <span className="font-mono flex items-center gap-0.5">
                                          <Clock className="w-2.5 h-2.5" />
                                          {evt.startTime} {evt.endTime ? ` - ${evt.endTime}` : ''}
                                        </span>
                                      </>
                                    )}
                                  </div>

                                  {evt.description && (
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 italic">
                                      {evt.description}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <button
                                onClick={() => handleDeleteEvent(evt.id)}
                                className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1.0 rounded-lg cursor-pointer transition-colors"
                                title={t('Delete Event', 'İşi Programdan Sil', 'Usuń Wydarzenie')}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                  </div>
                </div>

                {/* SCHEDULER TIPS AND SUMMARY */}
                <div className="bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200/40 dark:border-slate-800 p-5 space-y-3.5 text-xs">
                  <div className="font-bold text-slate-550 dark:text-slate-300 uppercase flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    {t('CALENDAR PLANNING TIPS', 'PLANLAMA İPUÇLARI', 'ZASADY PLANOWANIA')}
                  </div>
                  <ul className="space-y-2 text-slate-500 dark:text-slate-400 pl-4 list-disc text-left">
                    <li>{t('Click on any calendar cell to view and edit details for that specific day.', 'İlgili günün planını görmek veya yeni iş planı eklemek için takvim hücresine tıklayın.', 'Kliknij komórkę kalendarza, aby zobaczyć lub dodać szczegóły pracy.')}</li>
                    <li>{t('Spanning events are automatically visually marked on every date between start and end.', 'Birden fazla güne yayılan işler başlangıç ve bitiş arasındaki tüm günlerde gösterilir.', 'Wielodniowe zadania są automatycznie zaznaczane w całym przedziale dat.')}</li>
                    <li>{t('Choose color codes to distinguish plumber, painter, or masonry worker visits.', 'Boyacı, tesisatçı, nakliyeci veya beton dökümü gibi farklı ekipleri renk kodlarıyla ayırın.', 'Używaj kolorów do odróżnienia hydraulika, malarza itp.')}</li>
                  </ul>
                </div>

              </div>

            </div>
          )}
        </motion.div>
      </AnimatePresence>

    </div>
  );
}
