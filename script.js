/**
 * ============================================================================
 * EDUSUPPORT — SMART STUDENT EARLY-WARNING & ACADEMIC SUPPORT DASHBOARD
 * Register-First Flow, Interactive Requirements Wizard, & Clean LocalStorage Architecture
 * Vanilla JavaScript ES6+ | Offline-First Web Application
 * ============================================================================
 */

(function () {
  'use strict';

  // --- LOCALSTORAGE KEYS ---
  const KEYS = {
    USERS: 'edusupport_users',                  // Registered accounts: [{ id, name, email, password, role, studentId }]
    SESSION: 'edusupport_session',              // Active logged in user
    REQUIREMENTS: 'edusupport_requirements',    // User's configured institutional requirements
    SETTINGS: 'edusupport_settings',            // Heuristic scoring thresholds
    STUDENTS: 'edusupport_students',            // Student records (starts blank: [])
    ATTENDANCE: 'edusupport_attendance',        // Attendance records (starts blank: [])
    ASSESSMENTS: 'edusupport_assessments',      // Assessments and scores (starts blank: [])
    ASSIGNMENTS: 'edusupport_assignments',      // Assigned tasks (starts blank: [])
    SUPPORT_PLANS: 'edusupport_support_plans',  // Intervention plans (starts blank: [])
    ACTIVITY: 'edusupport_activity',            // Audit activity feed
    THEME: 'edusupport_theme'                   // 'dark' or 'light'
  };

  // Default suggested requirements for quick setup
  const DEFAULT_REQUIREMENTS = {
    schoolName: 'Apex Institute of Technology',
    department: 'Computer Science & Engineering',
    term: 'Fall Semester 2026',
    maxMarksScale: 100,
    subjects: ['Data Structures', 'Algorithms', 'Mathematics', 'Software Engineering']
  };

  // Default heuristic thresholds
  const DEFAULT_SETTINGS = {
    attendanceThreshold: 75,
    marksThreshold: 40,
    pendingThreshold: 3,
    dropThreshold: 10
  };

  // ============================================================================
  // 1. STORAGE SERVICE (SAFE LOCALSTORAGE ACCESS)
  // ============================================================================
  const Storage = {
    load(key, fallback = null) {
      try {
        const item = localStorage.getItem(key);
        if (item === null) return fallback;
        return JSON.parse(item);
      } catch (err) {
        console.error(`[Storage Error] Could not parse key "${key}":`, err);
        return fallback;
      }
    },

    save(key, val) {
      try {
        localStorage.setItem(key, JSON.stringify(val));
        return true;
      } catch (err) {
        console.error(`[Storage Error] Could not persist key "${key}":`, err);
        Toast.show('Storage Limit Exceeded', 'Unable to write to local browser storage.', 'error');
        return false;
      }
    },

    remove(key) {
      try {
        localStorage.removeItem(key);
      } catch (err) {
        console.error(`[Storage Error] Could not remove "${key}":`, err);
      }
    },

    getStats() {
      let totalBytes = 0;
      let totalRecords = 0;
      Object.values(KEYS).forEach(k => {
        const val = localStorage.getItem(k);
        if (val) {
          totalBytes += (k.length + val.length) * 2;
          try {
            const parsed = JSON.parse(val);
            if (Array.isArray(parsed)) totalRecords += parsed.length;
            else if (typeof parsed === 'object') totalRecords += 1;
          } catch (_) {}
        }
      });
      return {
        sizeKB: (totalBytes / 1024).toFixed(2),
        records: totalRecords
      };
    },

    clearWorkspace() {
      // Retain users and theme, clear students, attendance, assessments, tasks, plans
      [KEYS.STUDENTS, KEYS.ATTENDANCE, KEYS.ASSESSMENTS, KEYS.ASSIGNMENTS, KEYS.SUPPORT_PLANS, KEYS.ACTIVITY].forEach(k => {
        localStorage.removeItem(k);
      });
    },

    resetAll() {
      Object.values(KEYS).forEach(k => localStorage.removeItem(k));
    }
  };

  // ============================================================================
  // 2. TOAST NOTIFICATIONS SERVICE
  // ============================================================================
  const Toast = {
    container: null,

    init() {
      this.container = document.getElementById('toast-container');
    },

    show(title, message, type = 'info', duration = 3500) {
      if (!this.container) return;

      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;

      const iconSvg = {
        success: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
        error: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        warning: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        info: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
      }[type] || '';

      toast.innerHTML = `
        ${iconSvg}
        <div class="toast-content">
          <div class="toast-title">${Utils.escapeHtml(title)}</div>
          <div class="toast-message">${Utils.escapeHtml(message)}</div>
        </div>
        <button class="toast-close" title="Dismiss">&times;</button>
      `;

      const closeBtn = toast.querySelector('.toast-close');
      const dismiss = () => {
        toast.classList.add('toast-hiding');
        setTimeout(() => toast.remove(), 250);
      };

      closeBtn.addEventListener('click', dismiss);
      this.container.appendChild(toast);

      if (duration > 0) {
        setTimeout(dismiss, duration);
      }
    }
  };

  // ============================================================================
  // 3. UTILITIES & FORMATTERS
  // ============================================================================
  const Utils = {
    escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    },

    formatDate(dateStr) {
      if (!dateStr) return '--';
      try {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
          const d = new Date(parts[0], parts[1] - 1, parts[2]);
          return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
        return dateStr;
      } catch (_) {
        return dateStr;
      }
    },

    getInitials(name) {
      if (!name) return 'ES';
      return name
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
    },

    generateId(prefix = 'STU') {
      const students = Storage.load(KEYS.STUDENTS, []);
      const nums = students.map(s => {
        const match = s.id.match(/\d+$/);
        return match ? parseInt(match[0], 10) : 1000;
      });
      const nextNum = (nums.length ? Math.max(...nums) : 1000) + 1;
      return `${prefix}-${nextNum}`;
    },

    getTodayDate() {
      const d = new Date();
      return d.toISOString().split('T')[0];
    }
  };

  // ============================================================================
  // 4. EARLY-WARNING HEURISTIC SCORING ENGINE (CUSTOM REQUIREMENTS AWARE)
  // ============================================================================
  const EarlyWarningEngine = {
    evaluateStudent(studentId) {
      const settings = Storage.load(KEYS.SETTINGS, DEFAULT_SETTINGS);
      const attThreshold = Number(settings.attendanceThreshold) || 75;
      const marksThreshold = Number(settings.marksThreshold) || 40;
      const pendingThreshold = Number(settings.pendingThreshold) || 3;
      const dropThreshold = Number(settings.dropThreshold) || 10;

      const attendanceList = Storage.load(KEYS.ATTENDANCE, []).filter(a => a.studentId === studentId);
      const assessments = Storage.load(KEYS.ASSESSMENTS, []);
      const assignments = Storage.load(KEYS.ASSIGNMENTS, []).filter(a => a.studentId === studentId);

      // 1. Calculate Attendance Percentage
      let attPercentage = null;
      let consecutiveAbsences = 0;
      if (attendanceList.length > 0) {
        const sortedAtt = [...attendanceList].sort((a, b) => a.date.localeCompare(b.date));
        let presentCount = 0;
        sortedAtt.forEach(a => {
          if (a.status === 'P') presentCount += 1.0;
          else if (a.status === 'L') presentCount += 0.5;
        });
        attPercentage = Math.round((presentCount / sortedAtt.length) * 100);

        for (let i = sortedAtt.length - 1; i >= 0; i--) {
          if (sortedAtt[i].status === 'A') consecutiveAbsences++;
          else break;
        }
      }

      // 2. Calculate Assessment Average and Performance Drop
      let studentScores = [];
      let totalObtained = 0;
      let totalMax = 0;
      let performanceDrop = false;
      let dropDetails = null;

      assessments.forEach(asm => {
        if (asm.scores && asm.scores[studentId] !== undefined) {
          const obtained = Number(asm.scores[studentId]);
          const max = Number(asm.maxMarks) || 100;
          const pct = Math.round((obtained / max) * 100);
          studentScores.push({ title: asm.title, subject: asm.subject, date: asm.date, obtained, max, pct });
          totalObtained += obtained;
          totalMax += max;
        }
      });

      let avgMarks = null;
      if (totalMax > 0) {
        avgMarks = Math.round((totalObtained / totalMax) * 100);
      }

      if (studentScores.length >= 2) {
        const sortedScores = [...studentScores].sort((a, b) => a.date.localeCompare(b.date));
        const prev = sortedScores[sortedScores.length - 2].pct;
        const latest = sortedScores[sortedScores.length - 1].pct;
        if ((prev - latest) >= dropThreshold) {
          performanceDrop = true;
          dropDetails = `Dropped from ${prev}% to ${latest}% (-${prev - latest}%)`;
        }
      }

      // 3. Count Pending / Overdue Assignments
      const pendingTasks = assignments.filter(a => a.status === 'pending' || a.status === 'overdue');
      const overdueTasks = assignments.filter(a => a.status === 'overdue');

      // 4. Deterministic Transparent Scoring (0 - 100)
      let score = 0;
      const triggers = [];

      // Rule A: Attendance Below Configured Requirement (+30)
      if (attPercentage !== null && attPercentage < attThreshold) {
        score += 30;
        triggers.push({
          type: 'attendance',
          rule: `Attendance is ${attPercentage}%, below your configured ${attThreshold}% threshold`,
          points: 30,
          severity: 'high'
        });
      }

      if (consecutiveAbsences >= 3) {
        triggers.push({
          type: 'consecutive_absences',
          rule: `${consecutiveAbsences} consecutive absences recorded recently`,
          points: 0,
          severity: 'high'
        });
      }

      // Rule B: Average Marks Below Passing Requirement (+30)
      if (avgMarks !== null && avgMarks < marksThreshold) {
        score += 30;
        triggers.push({
          type: 'marks',
          rule: `Average assessment score is ${avgMarks}%, below ${marksThreshold}% passing requirement`,
          points: 30,
          severity: 'high'
        });
      }

      // Rule C: Pending Tasks Exceed Limit (+20)
      if (pendingTasks.length >= pendingThreshold) {
        score += 20;
        triggers.push({
          type: 'assignments',
          rule: `${pendingTasks.length} pending tasks (${overdueTasks.length} overdue), meeting critical threshold of ${pendingThreshold}`,
          points: 20,
          severity: 'medium'
        });
      }

      // Rule D: Exam Performance Drop (+20)
      if (performanceDrop) {
        score += 20;
        triggers.push({
          type: 'performance_drop',
          rule: `Performance drop detected: ${dropDetails}`,
          points: 20,
          severity: 'medium'
        });
      }

      score = Math.min(100, Math.max(0, score));

      let priority = 'low';
      if (score >= 51) priority = 'high';
      else if (score >= 21) priority = 'medium';

      let recommendation = 'Student is on track. Continue routine progress monitoring.';
      if (score >= 51) {
        recommendation = 'Urgent intervention recommended: Arrange mentor consultation, audit attendance hurdles, and construct a targeted milestone plan.';
      } else if (score >= 21) {
        if (attPercentage !== null && attPercentage < attThreshold) {
          recommendation = `Targeted attendance intervention: Schedule supportive check-in to identify attendance barriers and establish presence goals.`;
        } else if (avgMarks !== null && avgMarks < marksThreshold || performanceDrop) {
          recommendation = `Targeted academic intervention: Recommend tutoring in struggling subject topics and review foundational concepts.`;
        } else if (pendingTasks.length >= pendingThreshold) {
          recommendation = `Workload management intervention: Decompose overdue tasks into manageable milestones with scheduled check-ins.`;
        }
      }

      return {
        studentId,
        score,
        priority,
        attendanceRate: attPercentage,
        averageMarks: avgMarks,
        pendingAssignmentsCount: pendingTasks.length,
        overdueCount: overdueTasks.length,
        triggers,
        recommendation
      };
    },

    evaluateAll() {
      const students = Storage.load(KEYS.STUDENTS, []);
      return students.map(st => {
        const evalResult = this.evaluateStudent(st.id);
        return {
          ...st,
          evaluation: evalResult
        };
      });
    }
  };

  // ============================================================================
  // 5. CHART.JS MANAGER (BLANK STATE SAFE)
  // ============================================================================
  const ChartManager = {
    instances: {},

    hasChartJs() {
      return typeof window.Chart !== 'undefined';
    },

    getThemeColors() {
      const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
      return {
        text: isDark ? '#94A3B8' : '#475569',
        grid: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.06)',
        blue: '#3B82F6',
        cyan: '#06B6D4',
        violet: '#8B5CF6',
        emerald: '#10B981',
        amber: '#F59E0B',
        red: '#EF4444'
      };
    },

    destroyChart(key) {
      if (this.instances[key]) {
        try { this.instances[key].destroy(); } catch (_) {}
        delete this.instances[key];
      }
    },

    renderDashboardCharts() {
      if (!this.hasChartJs()) return;

      const colors = this.getThemeColors();
      const studentsWithEval = EarlyWarningEngine.evaluateAll();
      const settings = Storage.load(KEYS.SETTINGS, DEFAULT_SETTINGS);
      const req = Storage.load(KEYS.REQUIREMENTS, DEFAULT_REQUIREMENTS);

      // 1. Attendance Trend
      const attRecords = Storage.load(KEYS.ATTENDANCE, []);
      const dateMap = {};
      attRecords.forEach(a => {
        if (!dateMap[a.date]) dateMap[a.date] = { total: 0, present: 0 };
        dateMap[a.date].total++;
        if (a.status === 'P') dateMap[a.date].present += 1;
        else if (a.status === 'L') dateMap[a.date].present += 0.5;
      });

      const sortedDates = Object.keys(dateMap).sort();
      const attendancePercentages = sortedDates.map(d => Math.round((dateMap[d].present / dateMap[d].total) * 100));
      const labels = sortedDates.length ? sortedDates.map(d => d.slice(5)) : ['No Attendance Logged'];
      const dataPoints = sortedDates.length ? attendancePercentages : [0];

      this.destroyChart('attTrend');
      const ctxAtt = document.getElementById('chart-attendance-trend');
      if (ctxAtt) {
        this.instances.attTrend = new window.Chart(ctxAtt, {
          type: 'line',
          data: {
            labels,
            datasets: [
              {
                label: 'Cohort Attendance (%)',
                data: dataPoints,
                borderColor: colors.cyan,
                backgroundColor: 'rgba(6, 182, 212, 0.12)',
                borderWidth: 2.5,
                fill: true,
                tension: 0.35,
                pointRadius: sortedDates.length ? 4 : 0
              },
              {
                label: `Threshold (${settings.attendanceThreshold}%)`,
                data: labels.map(() => settings.attendanceThreshold),
                borderColor: colors.red,
                borderDash: [5, 5],
                borderWidth: 1.5,
                pointRadius: 0,
                fill: false
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { labels: { color: colors.text, font: { family: 'Inter', size: 11 } } }
            },
            scales: {
              y: { min: 0, max: 100, grid: { color: colors.grid }, ticks: { color: colors.text } },
              x: { grid: { color: colors.grid }, ticks: { color: colors.text } }
            }
          }
        });
      }

      // 2. Subject-Wise Performance (Custom subjects from user's requirements)
      const assessments = Storage.load(KEYS.ASSESSMENTS, []);
      const subjectsList = req.subjects && req.subjects.length ? req.subjects : ['General'];
      const subjectAverages = subjectsList.map(subj => {
        const relevant = assessments.filter(a => a.subject === subj);
        let total = 0, count = 0;
        relevant.forEach(asm => {
          Object.values(asm.scores || {}).forEach(score => {
            total += (score / asm.maxMarks) * 100;
            count++;
          });
        });
        return count ? Math.round(total / count) : 0;
      });

      this.destroyChart('subjPerf');
      const ctxSubj = document.getElementById('chart-subject-performance');
      if (ctxSubj) {
        this.instances.subjPerf = new window.Chart(ctxSubj, {
          type: 'bar',
          data: {
            labels: subjectsList,
            datasets: [{
              label: 'Average Score (%)',
              data: subjectAverages,
              backgroundColor: [colors.blue, colors.violet, colors.cyan, colors.emerald],
              borderRadius: 6
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              y: { min: 0, max: 100, grid: { color: colors.grid }, ticks: { color: colors.text } },
              x: { grid: { display: false }, ticks: { color: colors.text } }
            }
          }
        });
      }

      // 3. Risk Distribution Donut
      let high = 0, med = 0, low = 0;
      studentsWithEval.forEach(s => {
        if (s.evaluation.priority === 'high') high++;
        else if (s.evaluation.priority === 'medium') med++;
        else low++;
      });
      const riskData = (high || med || low) ? [high, med, low] : [0, 0, 1]; // neutral if blank

      this.destroyChart('riskDist');
      const ctxRisk = document.getElementById('chart-risk-distribution');
      if (ctxRisk) {
        this.instances.riskDist = new window.Chart(ctxRisk, {
          type: 'doughnut',
          data: {
            labels: ['High Risk', 'Medium Risk', 'Low Risk / On Track'],
            datasets: [{
              data: riskData,
              backgroundColor: [colors.red, colors.amber, colors.emerald],
              borderWidth: 0
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
              legend: { position: 'bottom', labels: { color: colors.text, boxWidth: 12, font: { size: 10.5 } } }
            }
          }
        });
      }

      // 4. Assignment Completion
      const tasks = Storage.load(KEYS.ASSIGNMENTS, []);
      let comp = 0, pend = 0, over = 0;
      tasks.forEach(t => {
        if (t.status === 'completed') comp++;
        else if (t.status === 'overdue') over++;
        else pend++;
      });
      const taskData = (comp || pend || over) ? [comp, pend, over] : [0, 0, 1];

      this.destroyChart('asgComp');
      const ctxAsg = document.getElementById('chart-assignment-completion');
      if (ctxAsg) {
        this.instances.asgComp = new window.Chart(ctxAsg, {
          type: 'doughnut',
          data: {
            labels: ['Completed', 'Pending', 'Overdue'],
            datasets: [{
              data: taskData,
              backgroundColor: [colors.emerald, colors.amber, colors.red],
              borderWidth: 0
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
              legend: { position: 'bottom', labels: { color: colors.text, boxWidth: 12, font: { size: 10.5 } } }
            }
          }
        });
      }
    },

    renderStudentProfileCharts(studentId) {
      if (!this.hasChartJs()) return;
      const colors = this.getThemeColors();
      const attendance = Storage.load(KEYS.ATTENDANCE, []).filter(a => a.studentId === studentId);
      const assessments = Storage.load(KEYS.ASSESSMENTS, []);

      // 1. Profile Attendance Trend
      const sortedAtt = [...attendance].sort((a, b) => a.date.localeCompare(b.date));
      const labels = sortedAtt.length ? sortedAtt.map(a => a.date.slice(5)) : ['No Sessions'];
      const values = sortedAtt.length ? sortedAtt.map(a => (a.status === 'P' ? 100 : (a.status === 'L' ? 50 : 0))) : [100];

      this.destroyChart('studentAtt');
      const ctxAtt = document.getElementById('chart-student-attendance');
      if (ctxAtt) {
        this.instances.studentAtt = new window.Chart(ctxAtt, {
          type: 'line',
          data: {
            labels,
            datasets: [{
              label: 'Presence State',
              data: values,
              borderColor: colors.blue,
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              borderWidth: 2,
              fill: true,
              stepped: true
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              y: { min: 0, max: 100, ticks: { stepSize: 50, color: colors.text }, grid: { color: colors.grid } },
              x: { grid: { color: colors.grid }, ticks: { color: colors.text } }
            }
          }
        });
      }

      // 2. Profile Subject Scores
      const subjScores = [];
      assessments.forEach(asm => {
        if (asm.scores && asm.scores[studentId] !== undefined) {
          const pct = Math.round((asm.scores[studentId] / asm.maxMarks) * 100);
          subjScores.push({ label: asm.subject.slice(0, 10), pct });
        }
      });

      this.destroyChart('studentAsm');
      const ctxAsm = document.getElementById('chart-student-assessments');
      if (ctxAsm) {
        this.instances.studentAsm = new window.Chart(ctxAsm, {
          type: 'bar',
          data: {
            labels: subjScores.length ? subjScores.map(s => s.label) : ['No Tests'],
            datasets: [{
              label: 'Score %',
              data: subjScores.length ? subjScores.map(s => s.pct) : [0],
              backgroundColor: subjScores.map(s => s.pct < 40 ? colors.red : (s.pct < 70 ? colors.amber : colors.emerald)),
              borderRadius: 4
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              y: { min: 0, max: 100, grid: { color: colors.grid }, ticks: { color: colors.text } },
              x: { grid: { display: false }, ticks: { color: colors.text } }
            }
          }
        });
      }
    }
  };

  // ============================================================================
  // 6. CSV EXPORTER
  // ============================================================================
  const CsvExporter = {
    exportStudents() {
      const studentsWithEval = EarlyWarningEngine.evaluateAll();
      const supportPlans = Storage.load(KEYS.SUPPORT_PLANS, []);

      if (studentsWithEval.length === 0) {
        Toast.show('No Students to Export', 'Please add at least one student record before downloading CSV.', 'warning');
        return;
      }

      const headers = [
        'Student ID',
        'Full Name',
        'Email',
        'Department',
        'Semester',
        'Attendance Rate (%)',
        'Average Assessment Score (%)',
        'Pending Assignments Count',
        'Early-Warning Risk Score (0-100)',
        'Support Priority Level',
        'Identified Triggers',
        'Active Support Plans Count'
      ];

      const rows = studentsWithEval.map(s => {
        const ev = s.evaluation;
        const studentPlans = supportPlans.filter(p => p.studentId === s.id && p.status !== 'completed');
        const triggersSummary = ev.triggers.map(t => t.rule).join('; ');

        return [
          s.id,
          s.name,
          s.email,
          s.department,
          s.semester,
          ev.attendanceRate !== null ? `${ev.attendanceRate}%` : 'N/A',
          ev.averageMarks !== null ? `${ev.averageMarks}%` : 'N/A',
          ev.pendingAssignmentsCount,
          ev.score,
          ev.priority.toUpperCase(),
          triggersSummary,
          studentPlans.length
        ];
      });

      const escapeField = field => {
        const stringVal = String(field ?? '');
        if (stringVal.includes(',') || stringVal.includes('"') || stringVal.includes('\n')) {
          return `"${stringVal.replace(/"/g, '""')}"`;
        }
        return stringVal;
      };

      const csvContent = '\uFEFF' + [
        headers.map(escapeField).join(','),
        ...rows.map(r => r.map(escapeField).join(','))
      ].join('\r\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `EduSupport_Student_Risk_Summary_${Utils.getTodayDate()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      Toast.show('CSV Downloaded', 'Exported student risk summary report.', 'success');
    }
  };

  // ============================================================================
  // 7. APP CONTROLLER (MAIN LOGIC)
  // ============================================================================
  const App = {
    currentSession: null,
    activeView: 'overview',
    studentFilter: {
      search: '',
      department: '',
      risk: '',
      attendance: '',
      marks: '',
      sortBy: 'riskScore',
      sortAsc: false,
      viewMode: 'table'
    },
    activeWarningFilter: 'all',
    activePlanFilter: 'all',
    activeTaskFilter: 'all',
    selectedAttendanceDate: Utils.getTodayDate(),
    wizardSubjects: ['Data Structures', 'Algorithms', 'Mathematics', 'Software Engineering'],

    init() {
      // 1. Initialize Toasts
      Toast.init();

      // 2. Initialize Theme
      this.initTheme();

      // 3. Initialize Auth & Session State
      this.initSession();

      // 4. Bind Global Event Handlers
      this.bindEvents();
    },

    initTheme() {
      const savedTheme = Storage.load(KEYS.THEME, 'dark');
      this.applyTheme(savedTheme);
    },

    applyTheme(theme) {
      document.documentElement.setAttribute('data-theme', theme);
      document.body.className = theme === 'dark' ? 'theme-dark' : 'theme-light';
      Storage.save(KEYS.THEME, theme);

      const moonIcon = document.getElementById('theme-moon-icon');
      const sunIcon = document.getElementById('theme-sun-icon');
      if (moonIcon && sunIcon) {
        if (theme === 'dark') {
          moonIcon.style.display = 'block';
          sunIcon.style.display = 'none';
        } else {
          moonIcon.style.display = 'none';
          sunIcon.style.display = 'block';
        }
      }

      if (this.activeView === 'overview') {
        setTimeout(() => ChartManager.renderDashboardCharts(), 50);
      }
    },

    toggleTheme() {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      this.applyTheme(next);
      Toast.show('Theme Updated', `Switched to ${next} mode.`, 'info', 1500);
    },

    initSession() {
      const session = Storage.load(KEYS.SESSION, null);
      if (session) {
        this.currentSession = session;
        // Check if requirements are configured yet
        const req = Storage.load(KEYS.REQUIREMENTS, null);
        if (!req) {
          this.showWizardView();
        } else {
          this.showAppView();
        }
      } else {
        this.showAuthView();
      }
    },

    showAuthView() {
      document.getElementById('auth-view').style.display = 'flex';
      document.getElementById('wizard-view').style.display = 'none';
      document.getElementById('app-view').style.display = 'none';

      // Default to "Register" tab if no users exist
      const users = Storage.load(KEYS.USERS, []);
      if (users.length === 0) {
        this.setAuthMode('register');
      } else {
        this.setAuthMode('login');
      }
    },

    setAuthMode(mode) {
      const isRegister = mode === 'register';
      document.getElementById('tab-register').classList.toggle('active', isRegister);
      document.getElementById('tab-login').classList.toggle('active', !isRegister);

      document.getElementById('group-name').style.display = isRegister ? 'block' : 'none';
      document.getElementById('group-role').style.display = isRegister ? 'block' : 'none';
      document.getElementById('group-confirm-password').style.display = isRegister ? 'block' : 'none';

      document.getElementById('auth-btn-label').innerText = isRegister ? 'Create Account & Proceed' : 'Sign In to Workspace';
    },

    showWizardView() {
      document.getElementById('auth-view').style.display = 'none';
      document.getElementById('wizard-view').style.display = 'flex';
      document.getElementById('app-view').style.display = 'none';

      // Populate current user preferences if any
      const existingReq = Storage.load(KEYS.REQUIREMENTS, DEFAULT_REQUIREMENTS);
      document.getElementById('req-school-name').value = existingReq.schoolName || '';
      document.getElementById('req-dept-name').value = existingReq.department || '';
      document.getElementById('req-term-name').value = existingReq.term || '';
      document.getElementById('req-grading-scale').value = existingReq.maxMarksScale || 100;

      const existingSettings = Storage.load(KEYS.SETTINGS, DEFAULT_SETTINGS);
      document.getElementById('req-att-threshold').value = existingSettings.attendanceThreshold || 75;
      document.getElementById('req-marks-threshold').value = existingSettings.marksThreshold || 40;
      document.getElementById('req-tasks-threshold').value = existingSettings.pendingThreshold || 3;
      document.getElementById('req-drop-threshold').value = existingSettings.dropThreshold || 10;

      this.wizardSubjects = existingReq.subjects && existingReq.subjects.length ? [...existingReq.subjects] : ['Data Structures', 'Algorithms', 'Mathematics', 'Software Engineering'];
      this.renderSubjectTags();
    },

    renderSubjectTags() {
      const container = document.getElementById('req-subjects-tags');
      if (!container) return;
      container.innerHTML = this.wizardSubjects.map((subj, index) => `
        <span class="subject-tag-pill">
          ${Utils.escapeHtml(subj)}
          <button type="button" class="subject-tag-remove" data-subj-index="${index}">&times;</button>
        </span>
      `).join('');

      container.querySelectorAll('.subject-tag-remove').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.getAttribute('data-subj-index'), 10);
          this.wizardSubjects.splice(idx, 1);
          this.renderSubjectTags();
        });
      });
    },

    showAppView() {
      document.getElementById('auth-view').style.display = 'none';
      document.getElementById('wizard-view').style.display = 'none';
      document.getElementById('app-view').style.display = 'flex';

      const isTeacher = this.currentSession.role === 'teacher';
      document.body.classList.toggle('role-teacher', isTeacher);
      document.body.classList.toggle('role-student', !isTeacher);

      const avatarText = Utils.getInitials(this.currentSession.name);
      document.getElementById('sidebar-avatar').innerText = avatarText;
      document.getElementById('sidebar-user-name').innerText = this.currentSession.name;
      document.getElementById('sidebar-user-role').innerText = isTeacher ? 'Teacher / Advisor' : 'Student Mode';

      document.getElementById('topbar-user-avatar').innerText = avatarText;
      document.getElementById('topbar-user-name').innerText = this.currentSession.name;
      document.getElementById('topbar-user-role-badge').innerText = isTeacher ? 'Teacher' : 'Student';

      document.getElementById('menu-user-name').innerText = this.currentSession.name;
      document.getElementById('menu-user-email').innerText = this.currentSession.email;

      const csAvatar = document.getElementById('cs-avatar');
      if (csAvatar) csAvatar.innerText = avatarText;
      const csName = document.getElementById('cs-name');
      if (csName) csName.innerText = this.currentSession.name;
      const csEmail = document.getElementById('cs-email');
      if (csEmail) csEmail.innerText = this.currentSession.email;
      const csBadge = document.getElementById('cs-badge');
      if (csBadge) {
        csBadge.className = `badge ${isTeacher ? 'badge-teacher' : 'badge-student'}`;
        csBadge.innerText = isTeacher ? 'Teacher' : 'Student';
      }

      // Apply Requirements to Headers & Selects
      this.applyConfiguredRequirements();

      // Render Active View
      this.switchView(this.activeView);
    },

    applyConfiguredRequirements() {
      const req = Storage.load(KEYS.REQUIREMENTS, DEFAULT_REQUIREMENTS);
      const settings = Storage.load(KEYS.SETTINGS, DEFAULT_SETTINGS);

      // Breadcrumb & Tags
      const tag = document.getElementById('sidebar-institution-tag');
      if (tag) tag.innerText = req.schoolName || 'Academic Suite';

      const bc = document.getElementById('breadcrumb-school-name');
      if (bc) bc.innerText = req.schoolName || 'EduSupport';

      const termLabel = document.getElementById('welcome-term-label');
      if (termLabel) termLabel.innerText = req.term || 'Fall Semester 2026';

      const deptLabel = document.getElementById('kpi-dept-label');
      if (deptLabel) deptLabel.innerText = req.department || 'My Department';

      // Threshold Labels in Overview KPI
      const attLabel = document.getElementById('kpi-att-threshold-label');
      if (attLabel) attLabel.innerText = `Threshold: ${settings.attendanceThreshold}%`;

      const passLabel = document.getElementById('kpi-pass-threshold-label');
      if (passLabel) passLabel.innerText = `Passing: ${settings.marksThreshold}%`;

      const chartAttBadge = document.getElementById('chart-att-threshold-badge');
      if (chartAttBadge) chartAttBadge.innerText = `Threshold: ${settings.attendanceThreshold}%`;

      // Early Warning Rule Explanations
      const rAtt = document.getElementById('rule-tag-att');
      if (rAtt) rAtt.innerText = `Attendance < ${settings.attendanceThreshold}% (+30 pts)`;

      const rMarks = document.getElementById('rule-tag-marks');
      if (rMarks) rMarks.innerText = `Avg Marks < ${settings.marksThreshold}% (+30 pts)`;

      const rTasks = document.getElementById('rule-tag-tasks');
      if (rTasks) rTasks.innerText = `${settings.pendingThreshold}+ Pending Tasks (+20 pts)`;

      const rDrop = document.getElementById('rule-tag-drop');
      if (rDrop) rDrop.innerText = `Exam Drop ≥ ${settings.dropThreshold}% (+20 pts)`;

      // Populate Assessment & Assignment Subject Dropdowns
      const subjects = req.subjects && req.subjects.length ? req.subjects : ['General'];
      ['af-subject', 'asf-subject'].forEach(selectId => {
        const select = document.getElementById(selectId);
        if (select) {
          select.innerHTML = subjects.map(s => `<option value="${Utils.escapeHtml(s)}">${Utils.escapeHtml(s)}</option>`).join('');
        }
      });

      // Populate Department Filter in Student Directory
      const deptFilter = document.getElementById('filter-student-dept');
      if (deptFilter && req.department) {
        deptFilter.innerHTML = `
          <option value="">All Departments</option>
          <option value="${Utils.escapeHtml(req.department)}">${Utils.escapeHtml(req.department)}</option>
        `;
      }
    },

    switchView(viewName) {
      this.activeView = viewName;

      document.querySelectorAll('.sidebar-nav .nav-item').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-view') === viewName);
      });

      const bc = document.getElementById('breadcrumb-current');
      if (bc) {
        const labels = {
          'overview': 'Overview',
          'students': 'Students Directory',
          'attendance': 'Attendance Register',
          'assessments': 'Assessments & Marks',
          'learning-activity': 'Learning Tasks',
          'early-warnings': 'Early-Warning Engine',
          'support-plans': 'Support Plans',
          'reports': 'Reports & Analytics',
          'settings': 'System Settings'
        };
        bc.innerText = labels[viewName] || 'Overview';
      }

      document.querySelectorAll('.view-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === `view-${viewName}`);
      });

      if (viewName === 'overview') this.renderOverview();
      else if (viewName === 'students') this.renderStudents();
      else if (viewName === 'attendance') this.renderAttendance();
      else if (viewName === 'assessments') this.renderAssessments();
      else if (viewName === 'learning-activity') this.renderLearningActivity();
      else if (viewName === 'early-warnings') this.renderEarlyWarnings();
      else if (viewName === 'support-plans') this.renderSupportPlans();
      else if (viewName === 'reports') this.renderReports();
      else if (viewName === 'settings') this.renderSettings();

      document.getElementById('sidebar').classList.remove('mobile-open');
    },

    // ==========================================================================
    // VIEW 1: OVERVIEW RENDERING
    // ==========================================================================
    renderOverview() {
      const studentsWithEval = EarlyWarningEngine.evaluateAll();
      const assignments = Storage.load(KEYS.ASSIGNMENTS, []);
      const supportPlans = Storage.load(KEYS.SUPPORT_PLANS, []);
      const activities = Storage.load(KEYS.ACTIVITY, []);

      const isTeacher = this.currentSession.role === 'teacher';

      const heading = document.getElementById('welcome-heading');
      if (heading) {
        heading.innerText = `Welcome, ${this.currentSession.name.split(' ')[0]} 👋`;
      }

      // 1. KPI Calculations (Starts naturally from 0)
      const totalStudents = studentsWithEval.length;
      document.getElementById('kpi-total-students').innerText = totalStudents;

      const validAtts = studentsWithEval.filter(s => s.evaluation.attendanceRate !== null);
      const avgAtt = validAtts.length
        ? Math.round(validAtts.reduce((acc, s) => acc + s.evaluation.attendanceRate, 0) / validAtts.length)
        : 0;
      document.getElementById('kpi-avg-attendance').innerText = `${avgAtt}%`;

      const validMarks = studentsWithEval.filter(s => s.evaluation.averageMarks !== null);
      const avgScore = validMarks.length
        ? Math.round(validMarks.reduce((acc, s) => acc + s.evaluation.averageMarks, 0) / validMarks.length)
        : 0;
      document.getElementById('kpi-avg-marks').innerText = `${avgScore}%`;

      const highRisk = studentsWithEval.filter(s => s.evaluation.priority === 'high');
      const medRisk = studentsWithEval.filter(s => s.evaluation.priority === 'medium');
      const totalAtRisk = highRisk.length + medRisk.length;
      document.getElementById('kpi-risk-students').innerText = totalAtRisk;
      document.getElementById('kpi-high-risk-count').innerText = `${highRisk.length} High Risk`;
      document.getElementById('kpi-med-risk-count').innerText = `${medRisk.length} Medium`;

      const pendingTasks = assignments.filter(a => a.status === 'pending' || a.status === 'overdue');
      const overdueTasks = assignments.filter(a => a.status === 'overdue');
      document.getElementById('kpi-pending-assignments').innerText = pendingTasks.length;
      document.getElementById('kpi-overdue-count').innerText = `${overdueTasks.length} overdue`;

      const openPlans = supportPlans.filter(p => p.status === 'in_progress' || p.status === 'pending');
      const resolvedPlans = supportPlans.filter(p => p.status === 'completed');
      document.getElementById('kpi-open-plans').innerText = openPlans.length;
      document.getElementById('kpi-plans-resolved').innerText = `${resolvedPlans.length} resolved`;

      // Update Nav Badges
      const navWarn = document.getElementById('nav-badge-warning-count');
      if (navWarn) {
        navWarn.innerText = highRisk.length;
        navWarn.style.display = highRisk.length > 0 ? 'inline-block' : 'none';
      }
      const navCounter = document.getElementById('nav-counter-students');
      if (navCounter) navCounter.innerText = totalStudents;
      const navPlans = document.getElementById('nav-chip-plans');
      if (navPlans) navPlans.innerText = openPlans.length;

      // 2. High-Priority Alert Feed
      const alertContainer = document.getElementById('overview-alert-list');
      if (alertContainer) {
        if (highRisk.length === 0) {
          alertContainer.innerHTML = '<div class="p-4 text-center text-muted" style="font-size:0.84rem;">No high-risk students detected. Your student cohort is healthy!</div>';
        } else {
          alertContainer.innerHTML = highRisk.map(st => `
            <div class="alert-item-row" data-student-id="${st.id}">
              <div class="alert-item-left">
                <div class="user-pill-avatar" style="background: linear-gradient(135deg, #EF4444, #F59E0B);">${Utils.getInitials(st.name)}</div>
                <div class="alert-item-meta">
                  <h4>${Utils.escapeHtml(st.name)} <span class="badge badge-danger">Score: ${st.evaluation.score}/100</span></h4>
                  <div class="alert-item-reason">${Utils.escapeHtml(st.evaluation.triggers[0]?.rule || 'Critical academic triggers')}</div>
                </div>
              </div>
              <button class="btn btn-sm btn-secondary btn-inspect-student" data-student-id="${st.id}">Examine Profile</button>
            </div>
          `).join('');
        }
      }

      // 3. Declining Trajectory Roster
      const decliningContainer = document.getElementById('overview-declining-list');
      if (decliningContainer) {
        const decliningStudents = studentsWithEval.filter(s => {
          return s.evaluation.triggers.some(t => t.type === 'performance_drop' || t.type === 'consecutive_absences' || t.type === 'attendance');
        });

        if (decliningStudents.length === 0) {
          decliningContainer.innerHTML = '<div class="p-4 text-center text-muted" style="font-size:0.84rem;">No declining trajectories detected.</div>';
        } else {
          decliningContainer.innerHTML = decliningStudents.slice(0, 4).map(st => {
            const dropTrigger = st.evaluation.triggers.find(t => t.type === 'performance_drop' || t.type === 'attendance');
            return `
              <div class="alert-item-row" data-student-id="${st.id}">
                <div class="alert-item-left">
                  <div class="user-pill-avatar">${Utils.getInitials(st.name)}</div>
                  <div class="alert-item-meta">
                    <h4>${Utils.escapeHtml(st.name)} <span class="badge badge-warning">${st.department}</span></h4>
                    <div class="alert-item-reason">${Utils.escapeHtml(dropTrigger?.rule || 'Attendance / assessment variance')}</div>
                  </div>
                </div>
                <button class="btn btn-sm btn-ghost btn-inspect-student" data-student-id="${st.id}">View</button>
              </div>
            `;
          }).join('');
        }
      }

      // 4. Activity Feed
      const activityFeed = document.getElementById('overview-activity-feed');
      if (activityFeed) {
        if (activities.length === 0) {
          activityFeed.innerHTML = '<div class="p-4 text-center text-muted" style="font-size:0.84rem;">No recent activities yet. Start by enrolling students or recording attendance.</div>';
        } else {
          activityFeed.innerHTML = activities.slice(0, 5).map(act => {
            const typeClass = act.type === 'warning' ? 'danger-icon' : (act.type === 'plan' ? 'emerald-icon' : 'blue-icon');
            return `
              <div class="timeline-entry">
                <div class="timeline-badge ${typeClass}">•</div>
                <div class="timeline-details">
                  <div class="timeline-title">${Utils.escapeHtml(act.title)}</div>
                  <div class="timeline-desc">${Utils.escapeHtml(act.desc)}</div>
                  <div class="timeline-time">${Utils.escapeHtml(act.timestamp)}</div>
                </div>
              </div>
            `;
          }).join('');
        }
      }

      // Render Charts
      setTimeout(() => ChartManager.renderDashboardCharts(), 50);

      document.querySelectorAll('.btn-inspect-student').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openStudentDetailModal(btn.getAttribute('data-student-id'));
        });
      });
    },

    // ==========================================================================
    // VIEW 2: STUDENTS ROSTER RENDERING
    // ==========================================================================
    renderStudents() {
      const studentsWithEval = EarlyWarningEngine.evaluateAll();
      const f = this.studentFilter;

      let filtered = studentsWithEval.filter(st => {
        if (f.search) {
          const q = f.search.toLowerCase();
          const match = st.name.toLowerCase().includes(q) || st.id.toLowerCase().includes(q) || st.email.toLowerCase().includes(q);
          if (!match) return false;
        }

        if (f.department && st.department !== f.department) return false;
        if (f.risk && st.evaluation.priority !== f.risk) return false;

        const settings = Storage.load(KEYS.SETTINGS, DEFAULT_SETTINGS);
        if (f.attendance) {
          const att = st.evaluation.attendanceRate;
          if (att === null) return false;
          if (f.attendance === 'under75' && att >= settings.attendanceThreshold) return false;
          if (f.attendance === '75to85' && (att < settings.attendanceThreshold || att > 85)) return false;
          if (f.attendance === 'over85' && att <= 85) return false;
        }

        if (f.marks) {
          const m = st.evaluation.averageMarks;
          if (m === null) return false;
          if (f.marks === 'failing' && m >= settings.marksThreshold) return false;
          if (f.marks === 'average' && (m < settings.marksThreshold || m > 70)) return false;
          if (f.marks === 'distinction' && m <= 70) return false;
        }

        return true;
      });

      filtered.sort((a, b) => {
        let valA, valB;
        if (f.sortBy === 'name') { valA = a.name; valB = b.name; }
        else if (f.sortBy === 'riskScore') { valA = a.evaluation.score; valB = b.evaluation.score; }
        else if (f.sortBy === 'attendance') { valA = a.evaluation.attendanceRate || 0; valB = b.evaluation.attendanceRate || 0; }
        else if (f.sortBy === 'avgMarks') { valA = a.evaluation.averageMarks || 0; valB = b.evaluation.averageMarks || 0; }
        else if (f.sortBy === 'pendingAssignments') { valA = a.evaluation.pendingAssignmentsCount; valB = b.evaluation.pendingAssignmentsCount; }
        else { valA = a.id; valB = b.id; }

        if (typeof valA === 'string') {
          return f.sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return f.sortAsc ? valA - valB : valB - valA;
      });

      document.getElementById('students-badge-count').innerText = `${studentsWithEval.length} Students`;
      document.getElementById('student-filter-counter').innerText = `Showing ${filtered.length} of ${studentsWithEval.length}`;

      const tableContainer = document.getElementById('students-table-container');
      const cardsContainer = document.getElementById('students-cards-container');
      const emptyState = document.getElementById('students-empty-state');

      if (filtered.length === 0) {
        tableContainer.style.display = 'none';
        cardsContainer.style.display = 'none';
        emptyState.style.display = 'block';
        return;
      }

      emptyState.style.display = 'none';

      if (f.viewMode === 'table') {
        tableContainer.style.display = 'block';
        cardsContainer.style.display = 'none';

        const tbody = document.getElementById('students-table-body');
        tbody.innerHTML = filtered.map(st => {
          const ev = st.evaluation;
          const badgeClass = ev.priority === 'high' ? 'badge-danger' : (ev.priority === 'medium' ? 'badge-warning' : 'badge-success');

          return `
            <tr data-student-id="${st.id}">
              <td><code>${st.id}</code></td>
              <td>
                <div class="flex-align-center gap-2">
                  <div class="user-pill-avatar" style="width:26px;height:26px;font-size:0.7rem;">${Utils.getInitials(st.name)}</div>
                  <div>
                    <strong>${Utils.escapeHtml(st.name)}</strong>
                    <div class="text-muted" style="font-size:0.72rem;">${Utils.escapeHtml(st.email)}</div>
                  </div>
                </div>
              </td>
              <td>${Utils.escapeHtml(st.department)} (Sem ${st.semester})</td>
              <td>${ev.attendanceRate !== null ? ev.attendanceRate + '%' : 'N/A'}</td>
              <td>${ev.averageMarks !== null ? ev.averageMarks + '%' : 'N/A'}</td>
              <td>${ev.pendingAssignmentsCount} tasks</td>
              <td>
                <span class="badge ${badgeClass}">${ev.priority.toUpperCase()} (${ev.score}/100)</span>
              </td>
              <td class="text-right">
                <button class="btn btn-sm btn-ghost btn-view-st" data-id="${st.id}" title="View profile">Profile</button>
                <button class="btn btn-sm btn-secondary btn-edit-st" data-id="${st.id}" title="Edit student">Edit</button>
                <button class="btn btn-sm btn-ghost text-danger btn-delete-st" data-id="${st.id}" title="Delete student">&times;</button>
              </td>
            </tr>
          `;
        }).join('');
      } else {
        tableContainer.style.display = 'none';
        cardsContainer.style.display = 'grid';

        cardsContainer.innerHTML = filtered.map(st => {
          const ev = st.evaluation;
          const badgeClass = ev.priority === 'high' ? 'badge-danger' : (ev.priority === 'medium' ? 'badge-warning' : 'badge-success');

          return `
            <div class="student-roster-card" data-student-id="${st.id}">
              <div class="src-header">
                <div class="src-avatar">${Utils.getInitials(st.name)}</div>
                <div class="src-info">
                  <div class="src-name">${Utils.escapeHtml(st.name)}</div>
                  <div class="src-id">${st.id} • ${st.department}</div>
                </div>
                <span class="badge ${badgeClass}">${ev.score}</span>
              </div>
              <div class="src-metrics">
                <div class="src-metric-item">
                  <span class="src-m-label">Attendance</span>
                  <span class="src-m-val">${ev.attendanceRate ?? '--'}%</span>
                </div>
                <div class="src-metric-item">
                  <span class="src-m-label">Avg Marks</span>
                  <span class="src-m-val">${ev.averageMarks ?? '--'}%</span>
                </div>
              </div>
              <div class="src-actions">
                <button class="btn btn-sm btn-primary flex-1 btn-view-st" data-id="${st.id}">Profile</button>
                <button class="btn btn-sm btn-secondary btn-edit-st" data-id="${st.id}">Edit</button>
                <button class="btn btn-sm btn-ghost text-danger btn-delete-st" data-id="${st.id}">Delete</button>
              </div>
            </div>
          `;
        }).join('');
      }

      document.querySelectorAll('.btn-view-st').forEach(b => {
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openStudentDetailModal(b.getAttribute('data-id'));
        });
      });
      document.querySelectorAll('.btn-edit-st').forEach(b => {
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openStudentFormModal(b.getAttribute('data-id'));
        });
      });
      document.querySelectorAll('.btn-delete-st').forEach(b => {
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          this.confirmDeleteStudent(b.getAttribute('data-id'));
        });
      });
    },

    // ==========================================================================
    // VIEW 3: ATTENDANCE MANAGEMENT
    // ==========================================================================
    renderAttendance() {
      const date = this.selectedAttendanceDate;
      const dateInput = document.getElementById('attendance-date-picker');
      if (dateInput) dateInput.value = date;

      const students = Storage.load(KEYS.STUDENTS, []);
      const attendanceList = Storage.load(KEYS.ATTENDANCE, []);

      let present = 0, late = 0, absent = 0;
      const dayRecords = attendanceList.filter(a => a.date === date);

      dayRecords.forEach(a => {
        if (a.status === 'P') present++;
        else if (a.status === 'L') late++;
        else if (a.status === 'A') absent++;
      });

      const totalMarked = present + late + absent;
      const rate = totalMarked ? Math.round(((present + late * 0.5) / totalMarked) * 100) : 0;

      document.getElementById('daily-count-present').innerText = present;
      document.getElementById('daily-count-late').innerText = late;
      document.getElementById('daily-count-absent').innerText = absent;
      document.getElementById('daily-presence-rate').innerText = `${rate}%`;

      const q = (document.getElementById('attendance-filter-search')?.value || '').toLowerCase();
      const filteredStudents = students.filter(s => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q));

      const tbody = document.getElementById('attendance-table-body');
      if (!tbody) return;

      if (filteredStudents.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center p-4 text-muted">No students enrolled yet. Add students in the Student Directory.</td></tr>';
        return;
      }

      tbody.innerHTML = filteredStudents.map(st => {
        const studentAtts = attendanceList.filter(a => a.studentId === st.id);
        const dayRecord = dayRecords.find(a => a.studentId === st.id);
        const currentStatus = dayRecord ? dayRecord.status : 'P';

        let stPres = 0;
        studentAtts.forEach(a => {
          if (a.status === 'P') stPres += 1;
          else if (a.status === 'L') stPres += 0.5;
        });
        const cumulativeRate = studentAtts.length ? Math.round((stPres / studentAtts.length) * 100) : 100;

        return `
          <tr>
            <td><code>${st.id}</code></td>
            <td><strong>${Utils.escapeHtml(st.name)}</strong></td>
            <td>${Utils.escapeHtml(st.department)}</td>
            <td>
              <span>${cumulativeRate}%</span>
              <span class="text-muted" style="font-size:0.72rem;">(${studentAtts.length} sessions)</span>
            </td>
            <td>
              <span class="badge ${currentStatus === 'P' ? 'badge-success' : (currentStatus === 'L' ? 'badge-warning' : 'badge-danger')}">
                ${currentStatus === 'P' ? 'Present' : (currentStatus === 'L' ? 'Late' : 'Absent')}
              </span>
            </td>
            <td class="text-center">
              <div class="att-btn-group">
                <button type="button" class="att-toggle ${currentStatus === 'P' ? 'active-present' : ''}" data-st-id="${st.id}" data-status="P">P</button>
                <button type="button" class="att-toggle ${currentStatus === 'L' ? 'active-late' : ''}" data-st-id="${st.id}" data-status="L">L</button>
                <button type="button" class="att-toggle ${currentStatus === 'A' ? 'active-absent' : ''}" data-st-id="${st.id}" data-status="A">A</button>
              </div>
            </td>
            <td>
              ${cumulativeRate < 75 ? `<span class="badge badge-warning">Low Cumulative</span>` : `<span class="text-muted">-</span>`}
            </td>
          </tr>
        `;
      }).join('');

      tbody.querySelectorAll('.att-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
          const stId = btn.getAttribute('data-st-id');
          const status = btn.getAttribute('data-status');
          this.setStudentAttendance(stId, date, status);
        });
      });
    },

    setStudentAttendance(studentId, date, status) {
      let attendanceList = Storage.load(KEYS.ATTENDANCE, []);
      const idx = attendanceList.findIndex(a => a.studentId === studentId && a.date === date);

      if (idx >= 0) {
        attendanceList[idx].status = status;
      } else {
        attendanceList.push({
          id: `att_${studentId}_${date}`,
          studentId,
          date,
          status,
          remarks: status === 'A' ? 'Unexcused absence' : (status === 'L' ? 'Late arrival' : 'Present')
        });
      }

      Storage.save(KEYS.ATTENDANCE, attendanceList);
      const student = Storage.load(KEYS.STUDENTS, []).find(s => s.id === studentId);
      this.logActivity('attendance', 'Attendance Marked', `Recorded ${status === 'P' ? 'Present' : (status === 'L' ? 'Late' : 'Absent')} for ${student?.name || studentId} on ${date}.`);

      this.renderAttendance();
      Toast.show('Attendance Saved', `Updated status for ${student?.name || studentId}.`, 'success', 1500);
    },

    markAllPresentForDate(date) {
      const students = Storage.load(KEYS.STUDENTS, []);
      if (students.length === 0) {
        Toast.show('No Students', 'Please add students first before marking attendance.', 'warning');
        return;
      }

      let attendanceList = Storage.load(KEYS.ATTENDANCE, []);
      students.forEach(st => {
        const idx = attendanceList.findIndex(a => a.studentId === st.id && a.date === date);
        if (idx >= 0) {
          attendanceList[idx].status = 'P';
        } else {
          attendanceList.push({
            id: `att_${st.id}_${date}`,
            studentId: st.id,
            date,
            status: 'P',
            remarks: 'Marked present'
          });
        }
      });

      Storage.save(KEYS.ATTENDANCE, attendanceList);
      this.logActivity('attendance', 'Batch Attendance Marked', `Marked all students present for ${date}.`);
      this.renderAttendance();
      Toast.show('Attendance Saved', `Marked all students Present for ${date}.`, 'success');
    },

    // ==========================================================================
    // VIEW 4: ASSESSMENTS RENDERING
    // ==========================================================================
    renderAssessments() {
      const assessments = Storage.load(KEYS.ASSESSMENTS, []);
      const container = document.getElementById('assessments-list-container');
      if (!container) return;

      if (assessments.length === 0) {
        container.innerHTML = '<div class="p-4 text-center text-muted" style="grid-column: 1 / -1;">No assessments registered yet. Click "+ New Assessment" to record an examination.</div>';
      } else {
        container.innerHTML = assessments.map(asm => {
          const scoreValues = Object.values(asm.scores || {});
          const studentCount = scoreValues.length;
          const avgScore = studentCount
            ? Math.round(scoreValues.reduce((a, b) => a + b, 0) / studentCount)
            : 0;
          const avgPercentage = Math.round((avgScore / asm.maxMarks) * 100);

          return `
            <div class="assessment-card">
              <div class="ac-subject">${Utils.escapeHtml(asm.subject)}</div>
              <div class="ac-title">${Utils.escapeHtml(asm.title)}</div>
              <div class="text-muted" style="font-size:0.75rem;">Conducted: ${Utils.formatDate(asm.date)}</div>

              <div class="ac-metrics-row">
                <div class="ac-m-item">
                  <span class="ac-m-label">Cohort Avg</span>
                  <span class="ac-m-val">${avgPercentage}%</span>
                </div>
                <div class="ac-m-item">
                  <span class="ac-m-label">Max Marks</span>
                  <span class="ac-m-val">${asm.maxMarks}</span>
                </div>
                <div class="ac-m-item">
                  <span class="ac-m-label">Graded</span>
                  <span class="ac-m-val">${studentCount}</span>
                </div>
              </div>

              <div class="flex gap-2">
                <button class="btn btn-sm btn-primary flex-1 btn-record-marks" data-asm-id="${asm.id}">Record Marks</button>
                <button class="btn btn-sm btn-ghost text-danger btn-delete-asm" data-asm-id="${asm.id}">&times;</button>
              </div>
            </div>
          `;
        }).join('');
      }

      // Subject summary table
      const subjTbody = document.getElementById('subject-performance-table-body');
      if (subjTbody) {
        const subjMap = {};
        assessments.forEach(asm => {
          if (!subjMap[asm.subject]) subjMap[asm.subject] = { asmCount: 0, scores: [] };
          subjMap[asm.subject].asmCount++;
          Object.values(asm.scores || {}).forEach(val => {
            subjMap[asm.subject].scores.push((val / asm.maxMarks) * 100);
          });
        });

        const subjects = Object.keys(subjMap);
        if (subjects.length === 0) {
          subjTbody.innerHTML = '<tr><td colspan="7" class="text-center p-4 text-muted">No assessments graded yet.</td></tr>';
        } else {
          subjTbody.innerHTML = subjects.map(subj => {
            const item = subjMap[subj];
            const avg = item.scores.length ? Math.round(item.scores.reduce((a, b) => a + b, 0) / item.scores.length) : 0;
            const highest = item.scores.length ? Math.round(Math.max(...item.scores)) : 0;
            const lowest = item.scores.length ? Math.round(Math.min(...item.scores)) : 0;
            const failingCount = item.scores.filter(s => s < 40).length;

            return `
              <tr>
                <td><strong>${Utils.escapeHtml(subj)}</strong></td>
                <td>${item.asmCount} tests</td>
                <td><span>${avg}%</span></td>
                <td class="text-success">${highest}%</td>
                <td class="text-danger">${lowest}%</td>
                <td><span class="${failingCount > 0 ? 'badge badge-danger' : 'badge badge-success'}">${failingCount} students</span></td>
                <td>${avg < 40 ? '<span class="badge badge-danger">Needs Review</span>' : '<span class="badge badge-success">Healthy</span>'}</td>
              </tr>
            `;
          }).join('');
        }
      }

      container.querySelectorAll('.btn-record-marks').forEach(b => {
        b.addEventListener('click', () => this.openMarksEntryModal(b.getAttribute('data-asm-id')));
      });
      container.querySelectorAll('.btn-delete-asm').forEach(b => {
        b.addEventListener('click', () => this.deleteAssessment(b.getAttribute('data-asm-id')));
      });
    },

    deleteAssessment(asmId) {
      if (!confirm('Are you sure you want to delete this assessment record?')) return;
      let assessments = Storage.load(KEYS.ASSESSMENTS, []);
      assessments = assessments.filter(a => a.id !== asmId);
      Storage.save(KEYS.ASSESSMENTS, assessments);
      this.renderAssessments();
      Toast.show('Assessment Removed', 'Assessment record deleted.', 'info');
    },

    // ==========================================================================
    // VIEW 5: LEARNING ACTIVITY TRACKER
    // ==========================================================================
    renderLearningActivity() {
      const assignments = Storage.load(KEYS.ASSIGNMENTS, []);
      const students = Storage.load(KEYS.STUDENTS, []);
      const filter = this.activeTaskFilter;

      let filtered = assignments;
      if (filter !== 'all') {
        filtered = assignments.filter(a => a.status === filter);
      }

      const isStudent = this.currentSession.role === 'student';
      if (isStudent && this.currentSession.studentId) {
        filtered = filtered.filter(a => a.studentId === this.currentSession.studentId);
      }

      const allForUser = isStudent ? assignments.filter(a => a.studentId === this.currentSession.studentId) : assignments;
      document.getElementById('count-tasks-all').innerText = allForUser.length;
      document.getElementById('count-tasks-pending').innerText = allForUser.filter(a => a.status === 'pending').length;
      document.getElementById('count-tasks-overdue').innerText = allForUser.filter(a => a.status === 'overdue').length;
      document.getElementById('count-tasks-completed').innerText = allForUser.filter(a => a.status === 'completed').length;

      const tbody = document.getElementById('assignments-table-body');
      if (!tbody) return;

      if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center p-4 text-muted">No assignments found. Click "+ New Assignment" to assign coursework.</td></tr>';
        return;
      }

      tbody.innerHTML = filtered.map(asg => {
        const student = students.find(s => s.id === asg.studentId);
        const statusBadge = asg.status === 'completed'
          ? 'badge-success'
          : (asg.status === 'overdue' ? 'badge-danger' : 'badge-warning');

        return `
          <tr>
            <td><strong>${Utils.escapeHtml(asg.title)}</strong></td>
            <td><span class="badge badge-neutral">${Utils.escapeHtml(asg.subject)}</span></td>
            <td>${student ? Utils.escapeHtml(student.name) : asg.studentId}</td>
            <td>${Utils.formatDate(asg.dueDate)}</td>
            <td><span class="badge ${statusBadge}">${asg.status.toUpperCase()}</span></td>
            <td>
              ${asg.status === 'overdue' ? '<span class="text-danger" style="font-size:0.75rem;">+20 Early-Warning risk pts</span>' : '<span class="text-muted" style="font-size:0.75rem;">Normal</span>'}
            </td>
            <td class="text-right">
              ${asg.status !== 'completed' ? `
                <button class="btn btn-sm btn-secondary btn-complete-task" data-id="${asg.id}">Mark Completed</button>
              ` : `
                <button class="btn btn-sm btn-ghost btn-reopen-task" data-id="${asg.id}">Reopen</button>
              `}
              ${!isStudent ? `<button class="btn btn-sm btn-ghost text-danger btn-delete-asg" data-id="${asg.id}">&times;</button>` : ''}
            </td>
          </tr>
        `;
      }).join('');

      tbody.querySelectorAll('.btn-complete-task').forEach(b => {
        b.addEventListener('click', () => this.toggleAssignmentStatus(b.getAttribute('data-id'), 'completed'));
      });
      tbody.querySelectorAll('.btn-reopen-task').forEach(b => {
        b.addEventListener('click', () => this.toggleAssignmentStatus(b.getAttribute('data-id'), 'pending'));
      });
      tbody.querySelectorAll('.btn-delete-asg').forEach(b => {
        b.addEventListener('click', () => this.deleteAssignment(b.getAttribute('data-id')));
      });
    },

    toggleAssignmentStatus(asgId, newStatus) {
      let assignments = Storage.load(KEYS.ASSIGNMENTS, []);
      const idx = assignments.findIndex(a => a.id === asgId);
      if (idx >= 0) {
        assignments[idx].status = newStatus;
        Storage.save(KEYS.ASSIGNMENTS, assignments);
        this.logActivity('task', 'Assignment Status Changed', `Assignment "${assignments[idx].title}" marked as ${newStatus}.`);
        this.renderLearningActivity();
        Toast.show('Task Updated', `Assignment marked as ${newStatus}.`, 'success');
      }
    },

    deleteAssignment(asgId) {
      if (!confirm('Delete this assignment?')) return;
      let assignments = Storage.load(KEYS.ASSIGNMENTS, []);
      assignments = assignments.filter(a => a.id !== asgId);
      Storage.save(KEYS.ASSIGNMENTS, assignments);
      this.renderLearningActivity();
      Toast.show('Assignment Removed', 'Assignment deleted.', 'info');
    },

    // ==========================================================================
    // VIEW 6: EARLY WARNINGS ENGINE RENDERING
    // ==========================================================================
    renderEarlyWarnings() {
      const studentsWithEval = EarlyWarningEngine.evaluateAll();
      const filter = this.activeWarningFilter;

      let filtered = studentsWithEval;
      if (filter !== 'all') {
        filtered = studentsWithEval.filter(s => s.evaluation.priority === filter);
      }

      if (this.currentSession.role === 'student' && this.currentSession.studentId) {
        filtered = filtered.filter(s => s.id === this.currentSession.studentId);
      }

      document.getElementById('count-warn-all').innerText = studentsWithEval.length;
      document.getElementById('count-warn-high').innerText = studentsWithEval.filter(s => s.evaluation.priority === 'high').length;
      document.getElementById('count-warn-medium').innerText = studentsWithEval.filter(s => s.evaluation.priority === 'medium').length;
      document.getElementById('count-warn-low').innerText = studentsWithEval.filter(s => s.evaluation.priority === 'low').length;

      const container = document.getElementById('warning-cards-container');
      if (!container) return;

      if (filtered.length === 0) {
        container.innerHTML = '<div class="p-4 text-center text-muted" style="grid-column: 1 / -1;">No early-warning alerts for this priority level.</div>';
        return;
      }

      filtered.sort((a, b) => b.evaluation.score - a.evaluation.score);

      container.innerHTML = filtered.map(st => {
        const ev = st.evaluation;
        const priorityClass = `priority-${ev.priority}`;
        const badgeClass = ev.priority === 'high' ? 'badge-danger' : (ev.priority === 'medium' ? 'badge-warning' : 'badge-success');
        const scoreColor = ev.priority === 'high' ? 'text-danger' : (ev.priority === 'medium' ? 'text-warning' : 'text-success');

        return `
          <div class="warning-card ${priorityClass}">
            <div class="wc-header">
              <div>
                <div class="wc-title">${Utils.escapeHtml(st.name)}</div>
                <div class="wc-dept">${st.id} • ${st.department} (Sem ${st.semester})</div>
              </div>
              <div class="wc-score-gauge">
                <div class="wc-score-number ${scoreColor}">${ev.score}</div>
                <div class="wc-score-label">Risk Index</div>
              </div>
            </div>

            <div class="wc-triggers-list">
              ${ev.triggers.length > 0 ? ev.triggers.map(t => `
                <div class="wc-trigger-item">
                  <svg class="wc-trigger-icon ${t.severity === 'high' ? 'text-danger' : 'text-warning'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/></svg>
                  <span>${Utils.escapeHtml(t.rule)} ${t.points > 0 ? `<strong>[+${t.points} pts]</strong>` : ''}</span>
                </div>
              `).join('') : `
                <div class="wc-trigger-item">
                  <span class="text-success">✓ Student on track across all indicators.</span>
                </div>
              `}
            </div>

            <div class="wc-recommendation">
              <span class="wc-rec-label">Recommended Next Action:</span>
              ${Utils.escapeHtml(ev.recommendation)}
            </div>

            <div class="wc-footer">
              <span class="badge ${badgeClass}">${ev.priority.toUpperCase()} PRIORITY</span>
              <div class="wc-actions">
                <button class="btn btn-sm btn-ghost btn-inspect-student" data-student-id="${st.id}">Profile</button>
                <button class="btn btn-sm btn-primary btn-plan-from-warn" data-student-id="${st.id}">Intervene</button>
              </div>
            </div>
          </div>
        `;
      }).join('');

      container.querySelectorAll('.btn-inspect-student').forEach(b => {
        b.addEventListener('click', () => this.openStudentDetailModal(b.getAttribute('data-student-id')));
      });
      container.querySelectorAll('.btn-plan-from-warn').forEach(b => {
        b.addEventListener('click', () => this.openSupportPlanModal(null, b.getAttribute('data-student-id')));
      });
    },

    // ==========================================================================
    // VIEW 7: SUPPORT PLANS RENDERING
    // ==========================================================================
    renderSupportPlans() {
      const plans = Storage.load(KEYS.SUPPORT_PLANS, []);
      const students = Storage.load(KEYS.STUDENTS, []);
      const filter = this.activePlanFilter;

      let filtered = plans;
      if (filter !== 'all') {
        filtered = plans.filter(p => p.status === filter);
      }

      const isStudent = this.currentSession.role === 'student';
      if (isStudent && this.currentSession.studentId) {
        filtered = filtered.filter(p => p.studentId === this.currentSession.studentId);
      }

      const allForRole = isStudent ? plans.filter(p => p.studentId === this.currentSession.studentId) : plans;
      document.getElementById('count-plans-all').innerText = allForRole.length;
      document.getElementById('count-plans-progress').innerText = allForRole.filter(p => p.status === 'in_progress').length;
      document.getElementById('count-plans-pending').innerText = allForRole.filter(p => p.status === 'pending').length;
      document.getElementById('count-plans-completed').innerText = allForRole.filter(p => p.status === 'completed').length;

      const container = document.getElementById('support-plans-container');
      if (!container) return;

      if (filtered.length === 0) {
        container.innerHTML = '<div class="p-4 text-center text-muted" style="grid-column: 1 / -1;">No support plans created yet. Click "+ Create Support Plan" to initiate an intervention.</div>';
        return;
      }

      container.innerHTML = filtered.map(plan => {
        const student = students.find(s => s.id === plan.studentId);
        const statusBadge = plan.status === 'completed' ? 'badge-success' : (plan.status === 'pending' ? 'badge-warning' : 'badge-teacher');

        return `
          <div class="support-plan-card" data-plan-id="${plan.id}">
            <div class="sp-header">
              <div>
                <div class="sp-student-title">${student ? Utils.escapeHtml(student.name) : plan.studentId}</div>
                <div class="sp-mentor-line">Mentor: ${Utils.escapeHtml(plan.mentor)} • Target: ${Utils.formatDate(plan.followUpDate)}</div>
              </div>
              <span class="badge ${statusBadge}">${plan.status.replace('_', ' ').toUpperCase()}</span>
            </div>

            <div class="sp-concern-box">
              <div class="sp-concern-label">Identified Concern</div>
              <div class="sp-concern-text">${Utils.escapeHtml(plan.concern)}</div>
            </div>

            <div class="mb-3" style="font-size:0.82rem;color:var(--text-secondary);">
              <strong>Strategy:</strong> ${Utils.escapeHtml(plan.intervention)}
            </div>

            <div class="sp-tasks-list">
              <div class="text-muted" style="font-size:0.72rem;font-weight:700;text-transform:uppercase;">Weekly Action Tasks</div>
              ${(plan.tasks || []).map(task => `
                <label class="sp-task-item ${task.completed ? 'completed' : ''}">
                  <input type="checkbox" class="plan-task-checkbox" data-plan-id="${plan.id}" data-task-id="${task.id}" ${task.completed ? 'checked' : ''}>
                  <span>${Utils.escapeHtml(task.text)}</span>
                </label>
              `).join('')}
            </div>

            ${plan.notes ? `
              <div class="p-2 mb-2" style="background:var(--bg-surface-elevated);border-radius:var(--radius-sm);font-size:0.75rem;color:var(--text-secondary);">
                <em>"${Utils.escapeHtml(plan.notes)}"</em>
              </div>
            ` : ''}

            <div class="sp-footer">
              <span class="text-muted" style="font-size:0.72rem;">Review: ${Utils.formatDate(plan.followUpDate)}</span>
              <div class="flex gap-2">
                ${!isStudent ? `
                  <button class="btn btn-sm btn-secondary btn-edit-plan" data-id="${plan.id}">Edit Plan</button>
                  <button class="btn btn-sm btn-ghost text-danger btn-delete-plan" data-id="${plan.id}">&times;</button>
                ` : `
                  <span class="badge badge-neutral">Student View</span>
                `}
              </div>
            </div>
          </div>
        `;
      }).join('');

      container.querySelectorAll('.plan-task-checkbox').forEach(chk => {
        chk.addEventListener('change', () => {
          const planId = chk.getAttribute('data-plan-id');
          const taskId = chk.getAttribute('data-task-id');
          this.toggleSupportPlanTask(planId, taskId, chk.checked);
        });
      });

      container.querySelectorAll('.btn-edit-plan').forEach(b => {
        b.addEventListener('click', () => this.openSupportPlanModal(b.getAttribute('data-id')));
      });
      container.querySelectorAll('.btn-delete-plan').forEach(b => {
        b.addEventListener('click', () => this.deleteSupportPlan(b.getAttribute('data-id')));
      });
    },

    toggleSupportPlanTask(planId, taskId, isChecked) {
      let plans = Storage.load(KEYS.SUPPORT_PLANS, []);
      const plan = plans.find(p => p.id === planId);
      if (plan && plan.tasks) {
        const task = plan.tasks.find(t => t.id === taskId);
        if (task) {
          task.completed = isChecked;
          const allDone = plan.tasks.every(t => t.completed);
          if (allDone) plan.status = 'completed';
          else if (plan.status === 'completed') plan.status = 'in_progress';

          Storage.save(KEYS.SUPPORT_PLANS, plans);
          this.logActivity('plan', 'Support Task Updated', `Task "${task.text}" was marked as ${isChecked ? 'completed' : 'pending'}.`);
          this.renderSupportPlans();
          Toast.show('Milestone Updated', `Task progress saved.`, 'success');
        }
      }
    },

    deleteSupportPlan(planId) {
      if (!confirm('Are you sure you want to delete this support plan?')) return;
      let plans = Storage.load(KEYS.SUPPORT_PLANS, []);
      plans = plans.filter(p => p.id !== planId);
      Storage.save(KEYS.SUPPORT_PLANS, plans);
      this.renderSupportPlans();
      Toast.show('Plan Removed', 'Support plan deleted.', 'info');
    },

    // ==========================================================================
    // VIEW 8: REPORTS & ANALYTICS
    // ==========================================================================
    renderReports() {
      const studentsWithEval = EarlyWarningEngine.evaluateAll();
      const supportPlans = Storage.load(KEYS.SUPPORT_PLANS, []);

      const deptMap = {};
      studentsWithEval.forEach(s => {
        if (!deptMap[s.department]) {
          deptMap[s.department] = { count: 0, attTotal: 0, marksTotal: 0, highRiskCount: 0 };
        }
        const d = deptMap[s.department];
        d.count++;
        d.attTotal += s.evaluation.attendanceRate || 0;
        d.marksTotal += s.evaluation.averageMarks || 0;
        if (s.evaluation.priority === 'high') d.highRiskCount++;
      });

      const deptTbody = document.getElementById('reports-dept-table-body');
      if (deptTbody) {
        const depts = Object.keys(deptMap);
        if (depts.length === 0) {
          deptTbody.innerHTML = '<tr><td colspan="7" class="text-center p-4 text-muted">No student records to generate cohort reports.</td></tr>';
        } else {
          deptTbody.innerHTML = depts.map(dept => {
            const d = deptMap[dept];
            const avgAtt = Math.round(d.attTotal / d.count);
            const avgMarks = Math.round(d.marksTotal / d.count);
            const highRiskPct = Math.round((d.highRiskCount / d.count) * 100);
            const activePlans = supportPlans.filter(p => {
              const st = studentsWithEval.find(s => s.id === p.studentId);
              return st && st.department === dept && p.status !== 'completed';
            }).length;

            return `
              <tr>
                <td><strong>${Utils.escapeHtml(dept)}</strong></td>
                <td>${d.count}</td>
                <td>${avgAtt}%</td>
                <td>${avgMarks}%</td>
                <td><span class="${highRiskPct > 0 ? 'badge badge-danger' : 'badge badge-success'}">${highRiskPct}% (${d.highRiskCount})</span></td>
                <td>${activePlans} plans</td>
                <td>${highRiskPct > 30 ? '<span class="badge badge-danger">Needs Attention</span>' : '<span class="badge badge-success">Optimal</span>'}</td>
              </tr>
            `;
          }).join('');
        }
      }

      const triggersList = document.getElementById('reports-triggers-list');
      if (triggersList) {
        let attCount = 0, marksCount = 0, tasksCount = 0, dropCount = 0;
        studentsWithEval.forEach(s => {
          s.evaluation.triggers.forEach(t => {
            if (t.type === 'attendance') attCount++;
            else if (t.type === 'marks') marksCount++;
            else if (t.type === 'assignments') tasksCount++;
            else if (t.type === 'performance_drop') dropCount++;
          });
        });

        triggersList.innerHTML = `
          <div class="storage-stats-box">
            <div class="storage-stat-item">
              <span>Low Attendance Triggers:</span>
              <strong>${attCount} students</strong>
            </div>
            <div class="storage-stat-item">
              <span>Below Passing Marks Triggers:</span>
              <strong>${marksCount} students</strong>
            </div>
            <div class="storage-stat-item">
              <span>Incomplete Tasks Limit Triggers:</span>
              <strong>${tasksCount} students</strong>
            </div>
            <div class="storage-stat-item">
              <span>Successive Exam Drops:</span>
              <strong>${dropCount} students</strong>
            </div>
          </div>
        `;
      }

      const resContainer = document.getElementById('reports-intervention-metrics');
      if (resContainer) {
        const totalPlans = supportPlans.length;
        const resolved = supportPlans.filter(p => p.status === 'completed').length;
        const resRate = totalPlans ? Math.round((resolved / totalPlans) * 100) : 0;

        resContainer.innerHTML = `
          <div class="storage-stats-box">
            <div class="storage-stat-item">
              <span>Total Support Plans Initiated:</span>
              <strong>${totalPlans}</strong>
            </div>
            <div class="storage-stat-item">
              <span>Successfully Resolved / Closed:</span>
              <strong class="text-success">${resolved}</strong>
            </div>
            <div class="storage-stat-item">
              <span>Intervention Resolution Rate:</span>
              <strong class="text-emerald">${resRate}%</strong>
            </div>
          </div>
        `;
      }
    },

    // ==========================================================================
    // VIEW 9: SETTINGS RENDERING
    // ==========================================================================
    renderSettings() {
      const stats = Storage.getStats();
      document.getElementById('storage-stat-records').innerText = `${stats.records} entities`;
      document.getElementById('storage-stat-size').innerText = `${stats.sizeKB} KB`;

      const settings = Storage.load(KEYS.SETTINGS, DEFAULT_SETTINGS);
      const attInput = document.getElementById('cfg-attendance-threshold');
      if (attInput) attInput.value = settings.attendanceThreshold || 75;
      const marksInput = document.getElementById('cfg-marks-threshold');
      if (marksInput) marksInput.value = settings.marksThreshold || 40;
      const tasksInput = document.getElementById('cfg-pending-threshold');
      if (tasksInput) tasksInput.value = settings.pendingThreshold || 3;
    },

    // ==========================================================================
    // MODALS: STUDENT DETAIL PROFILE
    // ==========================================================================
    openStudentDetailModal(studentId) {
      const student = Storage.load(KEYS.STUDENTS, []).find(s => s.id === studentId);
      if (!student) return;

      const evalResult = EarlyWarningEngine.evaluateStudent(studentId);
      const attendance = Storage.load(KEYS.ATTENDANCE, []).filter(a => a.studentId === studentId);
      const assessments = Storage.load(KEYS.ASSESSMENTS, []);
      const assignments = Storage.load(KEYS.ASSIGNMENTS, []).filter(a => a.studentId === studentId);
      const plans = Storage.load(KEYS.SUPPORT_PLANS, []).filter(p => p.studentId === studentId);

      document.getElementById('sd-modal-name').innerText = student.name;
      const riskBadge = document.getElementById('sd-modal-risk-badge');
      riskBadge.className = `badge ${evalResult.priority === 'high' ? 'badge-danger' : (evalResult.priority === 'medium' ? 'badge-warning' : 'badge-success')}`;
      riskBadge.innerText = `${evalResult.priority.toUpperCase()} RISK`;

      document.getElementById('sd-avatar').innerText = Utils.getInitials(student.name);
      document.getElementById('sd-name').innerText = student.name;
      document.getElementById('sd-id').innerText = student.id;
      document.getElementById('sd-dept').innerText = student.department;
      document.getElementById('sd-sem').innerText = `Semester ${student.semester}`;
      document.getElementById('sd-email').innerText = student.email;
      document.getElementById('sd-score').innerHTML = `${evalResult.score}<span>/100</span>`;

      document.getElementById('sd-snap-attendance').innerText = `${evalResult.attendanceRate ?? '--'}%`;
      document.getElementById('sd-snap-attendance-sub').innerText = (evalResult.attendanceRate < 75) ? 'Below threshold' : 'Sufficient';
      document.getElementById('sd-snap-marks').innerText = `${evalResult.averageMarks ?? '--'}%`;
      document.getElementById('sd-snap-marks-sub').innerText = (evalResult.averageMarks < 40) ? 'Below passing' : 'Passing';
      document.getElementById('sd-snap-tasks').innerText = evalResult.pendingAssignmentsCount;
      document.getElementById('sd-snap-plans').innerText = plans.filter(p => p.status !== 'completed').length;

      const reasonContainer = document.getElementById('sd-warning-reasons');
      reasonContainer.innerHTML = evalResult.triggers.length > 0 ? evalResult.triggers.map(t => `
        <div class="wc-trigger-item mb-1">
          <svg class="wc-trigger-icon ${t.severity === 'high' ? 'text-danger' : 'text-warning'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/></svg>
          <span>${Utils.escapeHtml(t.rule)} ${t.points > 0 ? `<strong>[+${t.points} pts]</strong>` : ''}</span>
        </div>
      `).join('') : '<div class="text-success" style="font-size:0.8rem;">No warning triggers active. Student is on track.</div>';

      document.getElementById('sd-recommendation-box').innerHTML = `
        <strong>Recommended Strategy:</strong><br>${Utils.escapeHtml(evalResult.recommendation)}
      `;

      const attTbody = document.getElementById('sd-attendance-tbody');
      attTbody.innerHTML = attendance.length ? attendance.map(a => `
        <tr>
          <td>${Utils.formatDate(a.date)}</td>
          <td><span class="badge ${a.status === 'P' ? 'badge-success' : (a.status === 'L' ? 'badge-warning' : 'badge-danger')}">${a.status === 'P' ? 'Present' : (a.status === 'L' ? 'Late' : 'Absent')}</span></td>
          <td>Lecture & Lab Session</td>
          <td>${Utils.escapeHtml(a.remarks)}</td>
        </tr>
      `).join('') : '<tr><td colspan="4" class="text-center text-muted">No attendance sessions recorded yet.</td></tr>';

      const asmTbody = document.getElementById('sd-assessments-tbody');
      const studentTests = [];
      assessments.forEach(asm => {
        if (asm.scores && asm.scores[studentId] !== undefined) {
          const obtained = asm.scores[studentId];
          const pct = Math.round((obtained / asm.maxMarks) * 100);
          studentTests.push({ title: asm.title, subject: asm.subject, obtained, max: asm.maxMarks, pct });
        }
      });

      asmTbody.innerHTML = studentTests.length ? studentTests.map(t => `
        <tr>
          <td><strong>${Utils.escapeHtml(t.title)}</strong></td>
          <td>${Utils.escapeHtml(t.subject)}</td>
          <td>${t.obtained}</td>
          <td>${t.max}</td>
          <td><span>${t.pct}%</span></td>
          <td>${t.pct < 40 ? '<span class="badge badge-danger">Fail</span>' : (t.pct >= 75 ? '<span class="badge badge-success">Distinction</span>' : '<span class="badge badge-neutral">Pass</span>')}</td>
        </tr>
      `).join('') : '<tr><td colspan="6" class="text-center text-muted">No assessment scores recorded yet.</td></tr>';

      const plansContainer = document.getElementById('sd-plans-container');
      plansContainer.innerHTML = plans.length ? plans.map(p => `
        <div class="support-plan-card mb-3">
          <div class="sp-header">
            <strong>${Utils.escapeHtml(p.concern)}</strong>
            <span class="badge ${p.status === 'completed' ? 'badge-success' : 'badge-teacher'}">${p.status.toUpperCase()}</span>
          </div>
          <div style="font-size:0.8rem;margin-bottom:0.5rem;"><strong>Intervention:</strong> ${Utils.escapeHtml(p.intervention)}</div>
          <div class="sp-tasks-list">
            ${(p.tasks || []).map(t => `<div class="sp-task-item ${t.completed ? 'completed' : ''}">• ${Utils.escapeHtml(t.text)}</div>`).join('')}
          </div>
        </div>
      `).join('') : '<div class="text-muted p-3 text-center">No active support plans for this student.</div>';

      const tasksContainer = document.getElementById('sd-tasks-container');
      tasksContainer.innerHTML = assignments.length ? assignments.map(a => `
        <div class="wc-trigger-item mb-2" style="justify-content:space-between;">
          <div>
            <strong>${Utils.escapeHtml(a.title)}</strong> (${a.subject})
            <div class="text-muted" style="font-size:0.72rem;">Due: ${Utils.formatDate(a.dueDate)}</div>
          </div>
          <span class="badge ${a.status === 'completed' ? 'badge-success' : (a.status === 'overdue' ? 'badge-danger' : 'badge-warning')}">${a.status.toUpperCase()}</span>
        </div>
      `).join('') : '<div class="text-muted p-3 text-center">No assignments assigned to this student.</div>';

      const btnEdit = document.getElementById('sd-btn-edit-student');
      btnEdit.onclick = () => {
        this.closeModal('modal-student-detail');
        this.openStudentFormModal(studentId);
      };

      const btnPlan = document.getElementById('sd-btn-create-plan');
      btnPlan.onclick = () => {
        this.closeModal('modal-student-detail');
        this.openSupportPlanModal(null, studentId);
      };

      document.querySelectorAll('.profile-tabs-bar .p-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelector('.profile-tabs-bar .p-tab-btn[data-ptab="overview"]').classList.add('active');
      document.querySelectorAll('.profile-tab-content').forEach(c => c.style.display = 'none');
      document.getElementById('ptab-overview').style.display = 'block';

      this.openModal('modal-student-detail');
      setTimeout(() => ChartManager.renderStudentProfileCharts(studentId), 100);
    },

    // ==========================================================================
    // MODALS: ADD / EDIT STUDENT
    // ==========================================================================
    openStudentFormModal(studentId = null) {
      const isEdit = !!studentId;
      document.getElementById('student-form-modal-title').innerText = isEdit ? 'Edit Student Details' : 'Add New Student';
      document.getElementById('student-form-id').value = studentId || '';

      const form = document.getElementById('form-student');
      form.reset();

      const req = Storage.load(KEYS.REQUIREMENTS, DEFAULT_REQUIREMENTS);

      if (isEdit) {
        const student = Storage.load(KEYS.STUDENTS, []).find(s => s.id === studentId);
        if (student) {
          document.getElementById('sf-id-display').value = student.id;
          document.getElementById('sf-name').value = student.name;
          document.getElementById('sf-email').value = student.email;
          document.getElementById('sf-department').value = student.department;
          document.getElementById('sf-semester').value = student.semester;
          document.getElementById('sf-mentor').value = student.advisor || this.currentSession.name;
        }
      } else {
        const newId = Utils.generateId('STU');
        document.getElementById('sf-id-display').value = newId;
        document.getElementById('sf-department').value = req.department || 'Computer Science';
        document.getElementById('sf-mentor').value = this.currentSession.name;
      }

      this.openModal('modal-student-form');
    },

    saveStudentFromForm() {
      const id = document.getElementById('student-form-id').value;
      const isEdit = !!id;
      const studentId = isEdit ? id : document.getElementById('sf-id-display').value.trim();
      const name = document.getElementById('sf-name').value.trim();
      const email = document.getElementById('sf-email').value.trim();
      const department = document.getElementById('sf-department').value.trim();
      const semester = parseInt(document.getElementById('sf-semester').value, 10);
      const advisor = document.getElementById('sf-mentor').value.trim();

      if (!studentId || !name || !email) {
        Toast.show('Validation Error', 'Please complete Student ID, Name, and Email.', 'error');
        return;
      }

      let students = Storage.load(KEYS.STUDENTS, []);

      if (isEdit) {
        const idx = students.findIndex(s => s.id === studentId);
        if (idx >= 0) {
          students[idx] = { ...students[idx], name, email, department, semester, advisor };
        }
      } else {
        // Prevent duplicate ID
        if (students.some(s => s.id === studentId)) {
          Toast.show('Duplicate ID', `Student ID ${studentId} already exists.`, 'error');
          return;
        }

        students.push({
          id: studentId,
          name,
          email,
          department,
          semester,
          advisor,
          createdDate: Utils.getTodayDate()
        });

        // Add initial attendance record for today
        const attList = Storage.load(KEYS.ATTENDANCE, []);
        attList.push({
          id: `att_${studentId}_${Utils.getTodayDate()}`,
          studentId,
          date: Utils.getTodayDate(),
          status: 'P',
          remarks: 'Enrolled in cohort'
        });
        Storage.save(KEYS.ATTENDANCE, attList);
      }

      Storage.save(KEYS.STUDENTS, students);
      this.logActivity('student', isEdit ? 'Student Record Updated' : 'New Student Registered', `${name} (${studentId}) added.`);
      this.closeModal('modal-student-form');

      this.render();
      Toast.show('Student Saved', `${name} has been enrolled successfully.`, 'success');
    },

    confirmDeleteStudent(studentId) {
      const student = Storage.load(KEYS.STUDENTS, []).find(s => s.id === studentId);
      if (!student) return;

      document.getElementById('confirm-title').innerText = 'Delete Student';
      document.getElementById('confirm-message').innerHTML = `Are you sure you want to delete <strong>${Utils.escapeHtml(student.name)} (${student.id})</strong>?`;

      const proceedBtn = document.getElementById('btn-confirm-proceed');
      proceedBtn.onclick = () => {
        let students = Storage.load(KEYS.STUDENTS, []).filter(s => s.id !== studentId);
        let attendance = Storage.load(KEYS.ATTENDANCE, []).filter(a => a.studentId !== studentId);
        let assignments = Storage.load(KEYS.ASSIGNMENTS, []).filter(a => a.studentId !== studentId);
        let plans = Storage.load(KEYS.SUPPORT_PLANS, []).filter(p => p.studentId !== studentId);
        let assessments = Storage.load(KEYS.ASSESSMENTS, []);

        assessments.forEach(asm => {
          if (asm.scores && asm.scores[studentId]) {
            delete asm.scores[studentId];
          }
        });

        Storage.save(KEYS.STUDENTS, students);
        Storage.save(KEYS.ATTENDANCE, attendance);
        Storage.save(KEYS.ASSIGNMENTS, assignments);
        Storage.save(KEYS.SUPPORT_PLANS, plans);
        Storage.save(KEYS.ASSESSMENTS, assessments);

        this.logActivity('warning', 'Student Deleted', `Removed student ${student.name} (${studentId}).`);
        this.closeModal('modal-confirm');
        this.render();
        Toast.show('Student Deleted', `Student record ${studentId} removed.`, 'warning');
      };

      this.openModal('modal-confirm');
    },

    // ==========================================================================
    // MODALS: ASSESSMENTS & MARKS ENTRY
    // ==========================================================================
    openAssessmentFormModal() {
      document.getElementById('form-assessment').reset();
      document.getElementById('af-date').value = Utils.getTodayDate();
      const req = Storage.load(KEYS.REQUIREMENTS, DEFAULT_REQUIREMENTS);
      document.getElementById('af-max-marks').value = req.maxMarksScale || 100;
      this.openModal('modal-assessment-form');
    },

    saveAssessmentFromForm() {
      const title = document.getElementById('af-title').value.trim();
      const subject = document.getElementById('af-subject').value;
      const maxMarks = parseInt(document.getElementById('af-max-marks').value, 10) || 100;
      const date = document.getElementById('af-date').value;

      if (!title || !date) {
        Toast.show('Error', 'Please enter assessment title and date.', 'error');
        return;
      }

      const assessments = Storage.load(KEYS.ASSESSMENTS, []);
      const newId = `asm_${Date.now()}`;
      assessments.push({
        id: newId,
        title,
        subject,
        maxMarks,
        date,
        scores: {}
      });

      Storage.save(KEYS.ASSESSMENTS, assessments);
      this.logActivity('assessment', 'Assessment Created', `Created ${title} (${subject}).`);
      this.closeModal('modal-assessment-form');
      this.renderAssessments();
      Toast.show('Assessment Created', `${title} created.`, 'success');

      setTimeout(() => this.openMarksEntryModal(newId), 250);
    },

    openMarksEntryModal(asmId) {
      const asm = Storage.load(KEYS.ASSESSMENTS, []).find(a => a.id === asmId);
      if (!asm) return;

      document.getElementById('mme-assessment-id').value = asm.id;
      document.getElementById('mme-title').innerText = asm.title;
      document.getElementById('mme-subtitle').innerText = `${asm.subject} • Max Marks: ${asm.maxMarks}`;

      const students = Storage.load(KEYS.STUDENTS, []);
      const tbody = document.getElementById('mme-table-body');

      if (students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center p-4 text-muted">No students enrolled yet. Add students in Student Directory.</td></tr>';
      } else {
        tbody.innerHTML = students.map(st => {
          const val = (asm.scores && asm.scores[st.id] !== undefined) ? asm.scores[st.id] : '';
          const pct = val !== '' ? Math.round((Number(val) / asm.maxMarks) * 100) + '%' : '--';

          return `
            <tr>
              <td><strong>${Utils.escapeHtml(st.name)}</strong></td>
              <td><code>${st.id}</code></td>
              <td>
                <input type="number" class="form-input form-input-sm mark-input" data-st-id="${st.id}" min="0" max="${asm.maxMarks}" value="${val}" style="width:90px;" placeholder="0-${asm.maxMarks}">
              </td>
              <td><span class="mark-pct-label" id="pct-${st.id}">${pct}</span></td>
            </tr>
          `;
        }).join('');

        tbody.querySelectorAll('.mark-input').forEach(inp => {
          inp.addEventListener('input', () => {
            const stId = inp.getAttribute('data-st-id');
            const v = inp.value;
            const label = document.getElementById(`pct-${stId}`);
            if (v !== '' && !isNaN(v)) {
              label.innerText = Math.round((Number(v) / asm.maxMarks) * 100) + '%';
            } else {
              label.innerText = '--';
            }
          });
        });
      }

      this.openModal('modal-marks-entry');
    },

    saveMarksFromEntry() {
      const asmId = document.getElementById('mme-assessment-id').value;
      let assessments = Storage.load(KEYS.ASSESSMENTS, []);
      const idx = assessments.findIndex(a => a.id === asmId);
      if (idx < 0) return;

      const asm = assessments[idx];
      asm.scores = asm.scores || {};

      document.querySelectorAll('#mme-table-body .mark-input').forEach(inp => {
        const stId = inp.getAttribute('data-st-id');
        const val = inp.value.trim();
        if (val !== '' && !isNaN(val)) {
          const num = Math.min(asm.maxMarks, Math.max(0, Number(val)));
          asm.scores[stId] = num;
        } else {
          delete asm.scores[stId];
        }
      });

      Storage.save(KEYS.ASSESSMENTS, assessments);
      this.logActivity('assessment', 'Assessment Scores Updated', `Updated recorded scores for ${asm.title}.`);
      this.closeModal('modal-marks-entry');
      this.render();
      Toast.show('Marks Recorded', `Saved marks for ${asm.title}.`, 'success');
    },

    // ==========================================================================
    // MODALS: SUPPORT PLAN
    // ==========================================================================
    openSupportPlanModal(planId = null, preselectedStudentId = null) {
      const isEdit = !!planId;
      document.getElementById('spf-title').innerText = isEdit ? 'Edit Support Plan' : 'Create Personalized Support Plan';
      document.getElementById('spf-id').value = planId || '';

      const students = Storage.load(KEYS.STUDENTS, []);
      const select = document.getElementById('spf-student-select');

      if (students.length === 0) {
        Toast.show('No Students', 'Please enroll students first before creating a support plan.', 'warning');
        return;
      }

      select.innerHTML = students.map(s => `
        <option value="${s.id}">${Utils.escapeHtml(s.name)} (${s.id})</option>
      `).join('');

      const form = document.getElementById('form-support-plan');
      form.reset();

      const tasksContainer = document.getElementById('spf-tasks-list');
      tasksContainer.innerHTML = '';

      if (isEdit) {
        const plan = Storage.load(KEYS.SUPPORT_PLANS, []).find(p => p.id === planId);
        if (plan) {
          select.value = plan.studentId;
          document.getElementById('spf-mentor').value = plan.mentor;
          document.getElementById('spf-concern').value = plan.concern;
          document.getElementById('spf-intervention').value = plan.intervention;
          document.getElementById('spf-start-date').value = plan.startDate;
          document.getElementById('spf-followup-date').value = plan.followUpDate;
          document.getElementById('spf-status').value = plan.status;
          document.getElementById('spf-notes').value = plan.notes || '';

          (plan.tasks || []).forEach(t => this.addSupportPlanTaskRow(t.text, t.completed));
        }
      } else {
        if (preselectedStudentId) select.value = preselectedStudentId;
        document.getElementById('spf-mentor').value = this.currentSession.name;
        document.getElementById('spf-start-date').value = Utils.getTodayDate();

        const d = new Date();
        d.setDate(d.getDate() + 14);
        document.getElementById('spf-followup-date').value = d.toISOString().split('T')[0];

        this.addSupportPlanTaskRow('Diagnostic consultation with faculty advisor', false);
      }

      this.openModal('modal-support-plan-form');
    },

    addSupportPlanTaskRow(text = '', completed = false) {
      const container = document.getElementById('spf-tasks-list');
      const row = document.createElement('div');
      row.className = 'flex gap-2 mb-2';
      row.innerHTML = `
        <input type="text" class="form-input spf-task-input" value="${Utils.escapeHtml(text)}" placeholder="Enter weekly milestone task...">
        <button type="button" class="btn btn-ghost text-danger btn-remove-task-row">&times;</button>
      `;
      row.querySelector('.btn-remove-task-row').addEventListener('click', () => row.remove());
      container.appendChild(row);
    },

    saveSupportPlanFromForm() {
      const planId = document.getElementById('spf-id').value;
      const isEdit = !!planId;

      const studentId = document.getElementById('spf-student-select').value;
      const mentor = document.getElementById('spf-mentor').value.trim();
      const concern = document.getElementById('spf-concern').value.trim();
      const intervention = document.getElementById('spf-intervention').value.trim();
      const startDate = document.getElementById('spf-start-date').value;
      const followUpDate = document.getElementById('spf-followup-date').value;
      const status = document.getElementById('spf-status').value;
      const notes = document.getElementById('spf-notes').value.trim();

      if (!concern || !intervention) {
        Toast.show('Validation Error', 'Please complete the concern and intervention fields.', 'error');
        return;
      }

      const tasks = [];
      document.querySelectorAll('#spf-tasks-list .spf-task-input').forEach((inp, idx) => {
        const val = inp.value.trim();
        if (val) tasks.push({ id: `spt_${Date.now()}_${idx}`, text: val, completed: false });
      });

      let plans = Storage.load(KEYS.SUPPORT_PLANS, []);

      if (isEdit) {
        const idx = plans.findIndex(p => p.id === planId);
        if (idx >= 0) {
          const oldTasks = plans[idx].tasks || [];
          const mergedTasks = tasks.map(t => {
            const found = oldTasks.find(ot => ot.text === t.text);
            return found ? { ...t, completed: found.completed } : t;
          });
          plans[idx] = { ...plans[idx], studentId, mentor, concern, intervention, startDate, followUpDate, status, notes, tasks: mergedTasks };
        }
      } else {
        plans.push({
          id: `sp_${Date.now()}`,
          studentId,
          mentor,
          concern,
          intervention,
          startDate,
          followUpDate,
          status,
          notes,
          tasks
        });
      }

      Storage.save(KEYS.SUPPORT_PLANS, plans);
      const student = Storage.load(KEYS.STUDENTS, []).find(s => s.id === studentId);
      this.logActivity('plan', isEdit ? 'Support Plan Updated' : 'Support Plan Established', `Intervention plan for ${student?.name || studentId} saved.`);

      this.closeModal('modal-support-plan-form');
      this.render();
      Toast.show('Plan Saved', `Support plan for ${student?.name || studentId} active.`, 'success');
    },

    // ==========================================================================
    // MODALS: ASSIGNMENT FORM
    // ==========================================================================
    openAssignmentFormModal() {
      const students = Storage.load(KEYS.STUDENTS, []);
      if (students.length === 0) {
        Toast.show('No Students', 'Please add students first before creating assignments.', 'warning');
        return;
      }

      const form = document.getElementById('form-assignment');
      form.reset();

      const d = new Date();
      d.setDate(d.getDate() + 7);
      document.getElementById('asf-due-date').value = d.toISOString().split('T')[0];

      const select = document.getElementById('asf-student-select');
      select.innerHTML = students.map(s => `
        <option value="${s.id}">${Utils.escapeHtml(s.name)} (${s.id})</option>
      `).join('');

      this.openModal('modal-assignment-form');
    },

    saveAssignmentFromForm() {
      const title = document.getElementById('asf-title-input').value.trim();
      const subject = document.getElementById('asf-subject').value;
      const studentId = document.getElementById('asf-student-select').value;
      const dueDate = document.getElementById('asf-due-date').value;
      const status = document.getElementById('asf-status').value;

      if (!title || !dueDate) {
        Toast.show('Error', 'Please enter assignment title and due date.', 'error');
        return;
      }

      let assignments = Storage.load(KEYS.ASSIGNMENTS, []);
      assignments.push({
        id: `asg_${Date.now()}`,
        title,
        subject,
        studentId,
        dueDate,
        status
      });

      Storage.save(KEYS.ASSIGNMENTS, assignments);
      this.logActivity('task', 'New Task Assigned', `Assigned "${title}" (${subject}) to student ${studentId}.`);
      this.closeModal('modal-assignment-form');
      this.renderLearningActivity();
      Toast.show('Assignment Created', `Assignment assigned to ${studentId}.`, 'success');
    },

    // ==========================================================================
    // AUDIT LOG SERVICE
    // ==========================================================================
    logActivity(type, title, desc) {
      const activities = Storage.load(KEYS.ACTIVITY, []);
      const now = new Date();
      const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      activities.unshift({
        id: `act_${Date.now()}`,
        type,
        title,
        desc,
        timestamp: timeStr
      });

      if (activities.length > 50) activities.pop();
      Storage.save(KEYS.ACTIVITY, activities);
    },

    openModal(modalId) {
      const modal = document.getElementById(modalId);
      if (modal) {
        modal.style.display = 'flex';
        const firstInput = modal.querySelector('input:not([type="hidden"]), select, textarea');
        if (firstInput) setTimeout(() => firstInput.focus(), 50);
      }
    },

    closeModal(modalId) {
      const modal = document.getElementById(modalId);
      if (modal) modal.style.display = 'none';
    },

    closeAllModals() {
      document.querySelectorAll('.modal-backdrop').forEach(m => m.style.display = 'none');
    },

    // ==========================================================================
    // GLOBAL EVENT BINDINGS
    // ==========================================================================
    bindEvents() {
      // 1. Theme toggle
      document.getElementById('btn-theme-toggle')?.addEventListener('click', () => this.toggleTheme());

      // 2. Auth tabs toggle
      document.getElementById('tab-register')?.addEventListener('click', () => this.setAuthMode('register'));
      document.getElementById('tab-login')?.addEventListener('click', () => this.setAuthMode('login'));

      // 3. Password visibility toggle
      document.getElementById('btn-toggle-pw')?.addEventListener('click', () => {
        const inp = document.getElementById('auth-password');
        inp.type = inp.type === 'password' ? 'text' : 'password';
      });

      // 4. Role selection toggle in register
      document.getElementById('auth-role-select')?.addEventListener('change', (e) => {
        const isStudent = e.target.value === 'student';
        document.getElementById('group-student-id').style.display = isStudent ? 'block' : 'none';
      });

      // 5. Auth Form Submission (Register or Sign In)
      document.getElementById('auth-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const isRegister = document.getElementById('tab-register').classList.contains('active');
        const email = document.getElementById('auth-email').value.trim().toLowerCase();
        const password = document.getElementById('auth-password').value;

        let users = Storage.load(KEYS.USERS, []);

        if (isRegister) {
          const name = document.getElementById('auth-name').value.trim();
          const role = document.getElementById('auth-role-select').value;
          const confirmPw = document.getElementById('auth-confirm-password').value;
          const studentId = document.getElementById('auth-student-id').value.trim() || Utils.generateId('STU');

          if (!name) {
            Toast.show('Error', 'Please enter your full name.', 'error');
            return;
          }
          if (password.length < 4) {
            Toast.show('Error', 'Password must be at least 4 characters.', 'error');
            return;
          }
          if (password !== confirmPw) {
            Toast.show('Password Mismatch', 'The passwords entered do not match.', 'error');
            return;
          }
          if (users.some(u => u.email === email)) {
            Toast.show('Account Exists', 'An account with this email already exists. Please sign in.', 'error');
            this.setAuthMode('login');
            return;
          }

          const newUser = {
            id: `usr_${Date.now()}`,
            name,
            email,
            password,
            role,
            studentId: role === 'student' ? studentId : undefined
          };

          users.push(newUser);
          Storage.save(KEYS.USERS, users);

          // Authenticate user
          this.currentSession = newUser;
          Storage.save(KEYS.SESSION, newUser);

          Toast.show('Registration Successful', `Welcome, ${name}! Now let's set up your requirements.`, 'success');

          // Open Requirements Setup Wizard
          this.showWizardView();
        } else {
          // Sign In
          const user = users.find(u => u.email === email && u.password === password);
          if (!user) {
            Toast.show('Invalid Credentials', 'Email or password not recognized in local storage.', 'error');
            return;
          }

          this.currentSession = user;
          Storage.save(KEYS.SESSION, user);

          Toast.show('Signed In', `Welcome back, ${user.name}!`, 'success');

          // Check if requirements are already saved
          const req = Storage.load(KEYS.REQUIREMENTS, null);
          if (!req) {
            this.showWizardView();
          } else {
            this.showAppView();
          }
        }
      });

      // 6. Wizard Tag Adding
      const addSubjectBtn = document.getElementById('btn-add-subject-tag');
      const newSubjectInput = document.getElementById('req-new-subject');
      const addSubjectHandler = () => {
        const val = newSubjectInput.value.trim();
        if (val && !this.wizardSubjects.includes(val)) {
          this.wizardSubjects.push(val);
          this.renderSubjectTags();
          newSubjectInput.value = '';
        }
      };

      addSubjectBtn?.addEventListener('click', addSubjectHandler);
      newSubjectInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          addSubjectHandler();
        }
      });

      // 7. Wizard Form Submission (Save User Requirements)
      document.getElementById('wizard-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const schoolName = document.getElementById('req-school-name').value.trim();
        const department = document.getElementById('req-dept-name').value.trim();
        const term = document.getElementById('req-term-name').value.trim();
        const maxMarksScale = parseInt(document.getElementById('req-grading-scale').value, 10) || 100;

        const attendanceThreshold = parseInt(document.getElementById('req-att-threshold').value, 10) || 75;
        const marksThreshold = parseInt(document.getElementById('req-marks-threshold').value, 10) || 40;
        const pendingThreshold = parseInt(document.getElementById('req-tasks-threshold').value, 10) || 3;
        const dropThreshold = parseInt(document.getElementById('req-drop-threshold').value, 10) || 10;

        if (!schoolName || !department || !term) {
          Toast.show('Error', 'Please complete the required institution fields.', 'error');
          return;
        }

        const requirements = {
          schoolName,
          department,
          term,
          maxMarksScale,
          subjects: this.wizardSubjects.length ? this.wizardSubjects : ['General Academic Topics']
        };

        const settings = {
          attendanceThreshold,
          marksThreshold,
          pendingThreshold,
          dropThreshold
        };

        Storage.save(KEYS.REQUIREMENTS, requirements);
        Storage.save(KEYS.SETTINGS, settings);

        Toast.show('Requirements Saved', 'Your dashboard is configured and ready!', 'success');
        this.showAppView();
      });

      // 8. Re-open Wizard Buttons
      document.getElementById('btn-reopen-wizard')?.addEventListener('click', () => this.showWizardView());
      document.getElementById('btn-menu-wizard')?.addEventListener('click', () => this.showWizardView());
      document.getElementById('btn-settings-reopen-wizard')?.addEventListener('click', () => this.showWizardView());

      // 9. Navigation items
      document.querySelectorAll('.sidebar-nav .nav-item').forEach(btn => {
        btn.addEventListener('click', () => {
          const view = btn.getAttribute('data-view');
          if (view) this.switchView(view);
        });
      });

      document.getElementById('sidebar-toggle-btn')?.addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('collapsed');
      });
      document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('mobile-open');
      });

      // 10. Quick Actions
      document.getElementById('btn-quick-add-student')?.addEventListener('click', () => this.openStudentFormModal());
      document.getElementById('btn-empty-add-student')?.addEventListener('click', () => this.openStudentFormModal());
      document.getElementById('btn-quick-new-plan')?.addEventListener('click', () => this.openSupportPlanModal());
      document.getElementById('btn-goto-warnings')?.addEventListener('click', () => this.switchView('early-warnings'));

      // 11. Global Search
      const globalSearch = document.getElementById('global-search-input');
      const searchDropdown = document.getElementById('search-results-dropdown');

      window.addEventListener('keydown', (e) => {
        if (e.key === '/' && document.activeElement !== globalSearch && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
          e.preventDefault();
          globalSearch?.focus();
        } else if (e.key === 'Escape') {
          this.closeAllModals();
          if (searchDropdown) searchDropdown.style.display = 'none';
        }
      });

      globalSearch?.addEventListener('input', (e) => {
        const query = e.target.value.trim().toLowerCase();
        if (!query) {
          searchDropdown.style.display = 'none';
          return;
        }

        const students = Storage.load(KEYS.STUDENTS, []);
        const plans = Storage.load(KEYS.SUPPORT_PLANS, []);

        const matchedStudents = students.filter(s => s.name.toLowerCase().includes(query) || s.id.toLowerCase().includes(query));
        const matchedPlans = plans.filter(p => p.concern.toLowerCase().includes(query));

        if (matchedStudents.length === 0 && matchedPlans.length === 0) {
          searchDropdown.innerHTML = '<div class="p-3 text-muted text-center" style="font-size:0.8rem;">No results found.</div>';
          searchDropdown.style.display = 'block';
          return;
        }

        let html = '';
        if (matchedStudents.length > 0) {
          html += '<div class="search-result-group-title">Students</div>';
          html += matchedStudents.slice(0, 4).map(s => `
            <div class="search-result-item" data-search-st="${s.id}">
              <div>
                <div class="s-meta-title">${Utils.escapeHtml(s.name)}</div>
                <div class="s-meta-sub">${s.id} • ${s.department}</div>
              </div>
              <span class="badge badge-neutral">Profile</span>
            </div>
          `).join('');
        }

        if (matchedPlans.length > 0) {
          html += '<div class="search-result-group-title">Support Plans</div>';
          html += matchedPlans.slice(0, 3).map(p => `
            <div class="search-result-item" data-search-plan="${p.id}">
              <div>
                <div class="s-meta-title">${Utils.escapeHtml(p.concern.slice(0, 40))}...</div>
                <div class="s-meta-sub">Mentor: ${Utils.escapeHtml(p.mentor)}</div>
              </div>
              <span class="badge badge-teacher">Open Plan</span>
            </div>
          `).join('');
        }

        searchDropdown.innerHTML = html;
        searchDropdown.style.display = 'block';

        searchDropdown.querySelectorAll('[data-search-st]').forEach(item => {
          item.addEventListener('click', () => {
            searchDropdown.style.display = 'none';
            this.openStudentDetailModal(item.getAttribute('data-search-st'));
          });
        });

        searchDropdown.querySelectorAll('[data-search-plan]').forEach(item => {
          item.addEventListener('click', () => {
            searchDropdown.style.display = 'none';
            this.switchView('support-plans');
          });
        });
      });

      // 12. Dropdowns
      const notifBtn = document.getElementById('btn-notifications');
      const notifDropdown = document.getElementById('notif-dropdown');
      notifBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        const isShown = notifDropdown.style.display === 'block';
        notifDropdown.style.display = isShown ? 'none' : 'block';
      });

      document.getElementById('btn-view-all-warnings')?.addEventListener('click', () => {
        notifDropdown.style.display = 'none';
        this.switchView('early-warnings');
      });

      document.getElementById('btn-mark-all-read')?.addEventListener('click', () => {
        document.getElementById('topbar-notif-count').style.display = 'none';
        Toast.show('Notifications Cleared', 'Alerts cleared.', 'info', 1500);
      });

      const userBtn = document.getElementById('btn-user-profile');
      const profileDropdown = document.getElementById('profile-dropdown');
      userBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        profileDropdown.style.display = profileDropdown.style.display === 'block' ? 'none' : 'block';
      });

      window.addEventListener('click', () => {
        if (notifDropdown) notifDropdown.style.display = 'none';
        if (profileDropdown) profileDropdown.style.display = 'none';
        if (searchDropdown) searchDropdown.style.display = 'none';
      });

      // 13. Logout
      const doLogout = () => {
        this.currentSession = null;
        Storage.remove(KEYS.SESSION);
        this.showAuthView();
        Toast.show('Signed Out', 'You have been signed out.', 'info');
      };
      document.getElementById('btn-logout')?.addEventListener('click', doLogout);
      document.getElementById('btn-settings-logout')?.addEventListener('click', doLogout);
      document.getElementById('btn-profile-settings')?.addEventListener('click', () => this.switchView('settings'));

      // 14. Filters & Sorters
      const fSearch = document.getElementById('filter-student-search');
      fSearch?.addEventListener('input', (e) => {
        this.studentFilter.search = e.target.value.trim();
        this.renderStudents();
      });

      document.getElementById('filter-student-dept')?.addEventListener('change', (e) => {
        this.studentFilter.department = e.target.value;
        this.renderStudents();
      });
      document.getElementById('filter-student-risk')?.addEventListener('change', (e) => {
        this.studentFilter.risk = e.target.value;
        this.renderStudents();
      });
      document.getElementById('filter-student-attendance')?.addEventListener('change', (e) => {
        this.studentFilter.attendance = e.target.value;
        this.renderStudents();
      });
      document.getElementById('filter-student-marks')?.addEventListener('change', (e) => {
        this.studentFilter.marks = e.target.value;
        this.renderStudents();
      });
      document.getElementById('sort-student-by')?.addEventListener('change', (e) => {
        this.studentFilter.sortBy = e.target.value;
        this.renderStudents();
      });
      document.getElementById('btn-sort-direction')?.addEventListener('click', () => {
        this.studentFilter.sortAsc = !this.studentFilter.sortAsc;
        this.renderStudents();
      });

      document.getElementById('btn-view-table')?.addEventListener('click', (e) => {
        e.currentTarget.classList.add('active');
        document.getElementById('btn-view-cards').classList.remove('active');
        this.studentFilter.viewMode = 'table';
        this.renderStudents();
      });

      document.getElementById('btn-view-cards')?.addEventListener('click', (e) => {
        e.currentTarget.classList.add('active');
        document.getElementById('btn-view-table').classList.remove('active');
        this.studentFilter.viewMode = 'cards';
        this.renderStudents();
      });

      document.getElementById('btn-clear-student-filters')?.addEventListener('click', () => {
        this.studentFilter = {
          search: '',
          department: '',
          risk: '',
          attendance: '',
          marks: '',
          sortBy: 'riskScore',
          sortAsc: false,
          viewMode: this.studentFilter.viewMode
        };
        if (fSearch) fSearch.value = '';
        document.getElementById('filter-student-dept').value = '';
        document.getElementById('filter-student-risk').value = '';
        document.getElementById('filter-student-attendance').value = '';
        document.getElementById('filter-student-marks').value = '';
        document.getElementById('sort-student-by').value = 'riskScore';
        this.renderStudents();
      });

      // 15. Attendance Controls
      const attPicker = document.getElementById('attendance-date-picker');
      attPicker?.addEventListener('change', (e) => {
        this.selectedAttendanceDate = e.target.value;
        this.renderAttendance();
      });

      document.getElementById('btn-date-today')?.addEventListener('click', () => {
        this.selectedAttendanceDate = Utils.getTodayDate();
        this.renderAttendance();
      });

      document.getElementById('btn-date-prev')?.addEventListener('click', () => {
        const d = new Date(this.selectedAttendanceDate);
        d.setDate(d.getDate() - 1);
        this.selectedAttendanceDate = d.toISOString().split('T')[0];
        this.renderAttendance();
      });

      document.getElementById('btn-date-next')?.addEventListener('click', () => {
        const d = new Date(this.selectedAttendanceDate);
        d.setDate(d.getDate() + 1);
        this.selectedAttendanceDate = d.toISOString().split('T')[0];
        this.renderAttendance();
      });

      document.getElementById('attendance-filter-search')?.addEventListener('input', () => this.renderAttendance());
      document.getElementById('btn-attendance-mark-all-present')?.addEventListener('click', () => {
        this.markAllPresentForDate(this.selectedAttendanceDate);
      });

      // 16. Filter Pills
      document.querySelectorAll('[data-task-filter]').forEach(pill => {
        pill.addEventListener('click', () => {
          document.querySelectorAll('[data-task-filter]').forEach(p => p.classList.remove('active'));
          pill.classList.add('active');
          this.activeTaskFilter = pill.getAttribute('data-task-filter');
          this.renderLearningActivity();
        });
      });

      document.querySelectorAll('[data-warning-filter]').forEach(pill => {
        pill.addEventListener('click', () => {
          document.querySelectorAll('[data-warning-filter]').forEach(p => p.classList.remove('active'));
          pill.classList.add('active');
          this.activeWarningFilter = pill.getAttribute('data-warning-filter');
          this.renderEarlyWarnings();
        });
      });

      document.querySelectorAll('[data-plan-filter]').forEach(pill => {
        pill.addEventListener('click', () => {
          document.querySelectorAll('[data-plan-filter]').forEach(p => p.classList.remove('active'));
          pill.classList.add('active');
          this.activePlanFilter = pill.getAttribute('data-plan-filter');
          this.renderSupportPlans();
        });
      });

      // 17. Student Profile Tabs
      document.querySelectorAll('.profile-tabs-bar .p-tab-btn').forEach(tabBtn => {
        tabBtn.addEventListener('click', () => {
          document.querySelectorAll('.profile-tabs-bar .p-tab-btn').forEach(b => b.classList.remove('active'));
          tabBtn.classList.add('active');
          const ptab = tabBtn.getAttribute('data-ptab');
          document.querySelectorAll('.profile-tab-content').forEach(c => c.style.display = 'none');
          const target = document.getElementById(`ptab-${ptab}`);
          if (target) target.style.display = 'block';
        });
      });

      // 18. Modals
      document.getElementById('btn-add-student-modal')?.addEventListener('click', () => this.openStudentFormModal());
      document.getElementById('btn-create-assessment-modal')?.addEventListener('click', () => this.openAssessmentFormModal());
      document.getElementById('btn-create-assignment-modal')?.addEventListener('click', () => this.openAssignmentFormModal());
      document.getElementById('btn-create-support-plan-modal')?.addEventListener('click', () => this.openSupportPlanModal());
      document.getElementById('btn-spf-add-task')?.addEventListener('click', () => this.addSupportPlanTaskRow());

      document.querySelectorAll('[data-modal-close]').forEach(btn => {
        btn.addEventListener('click', () => {
          const modalId = btn.getAttribute('data-modal-close');
          this.closeModal(modalId);
        });
      });

      document.querySelectorAll('.modal-backdrop').forEach(modal => {
        modal.addEventListener('click', (e) => {
          if (e.target === modal) this.closeModal(modal.id);
        });
      });

      // 19. Forms
      document.getElementById('form-student')?.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveStudentFromForm();
      });

      document.getElementById('form-assessment')?.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveAssessmentFromForm();
      });

      document.getElementById('form-marks-entry')?.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveMarksFromEntry();
      });

      document.getElementById('form-support-plan')?.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveSupportPlanFromForm();
      });

      document.getElementById('form-assignment')?.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveAssignmentFromForm();
      });

      // 20. CSV Export
      document.getElementById('btn-export-students-csv')?.addEventListener('click', () => CsvExporter.exportStudents());
      document.getElementById('btn-export-reports-csv')?.addEventListener('click', () => CsvExporter.exportStudents());

      // 21. Settings Form
      document.getElementById('settings-thresholds-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const attVal = Number(document.getElementById('cfg-attendance-threshold').value);
        const marksVal = Number(document.getElementById('cfg-marks-threshold').value);
        const tasksVal = Number(document.getElementById('cfg-pending-threshold').value);

        const currentSettings = Storage.load(KEYS.SETTINGS, DEFAULT_SETTINGS);
        currentSettings.attendanceThreshold = attVal;
        currentSettings.marksThreshold = marksVal;
        currentSettings.pendingThreshold = tasksVal;

        Storage.save(KEYS.SETTINGS, currentSettings);
        Toast.show('Settings Saved', 'Early-Warning thresholds updated.', 'success');
        this.applyConfiguredRequirements();
        this.render();
      });

      // 22. Clear Workspace Data
      document.getElementById('btn-settings-clear-all')?.addEventListener('click', () => {
        if (confirm('Clear all student data, attendance, assessments, and support plans? Your account and requirements configuration will remain.')) {
          Storage.clearWorkspace();
          Toast.show('Workspace Reset', 'All student data cleared.', 'info');
          this.render();
        }
      });
    },

    render() {
      if (this.currentSession) {
        this.switchView(this.activeView);
      }
    }
  };

  // Start on DOM content loaded
  window.addEventListener('DOMContentLoaded', () => {
    App.init();
  });

})();
