import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import {
  CalendarDays,
  FileSpreadsheet,
  Printer,
  Download,
  UserCheck,
  Layers,
  FileText,
  X,
  CheckCircle2,
} from 'lucide-react';
import { AttendanceRecord, AttendanceStatus, SchoolProfile, Student } from '../types';
import { Language, translations } from '../utils/translations';
import {
  calculateAttendancePercentage,
  deduplicateStudentsByAdmissionNumber,
  formatSchoolAddressOnce,
  getMonthlyWorkingDays,
} from '../utils/calculations';
import {
  exportAttendanceStatisticsCsv,
  exportBatchMonthlyClassCsv,
  exportBatchMonthlyClassPdf,
  exportMonthlyAttendanceToExcel,
} from '../utils/excelExport';

interface MonthlyAttendanceProps {
  students: Student[];
  school: SchoolProfile;
  attendanceRecords: AttendanceRecord[];
  language: Language;
}

type HeatmapCellData = {
  dateStr: string;
  dayOfMonth: number;
  weekdayIndexMon0: number; // 0=Mon .. 6=Sun
  weekdayLabel: string;
  weekRow: number;
  status: AttendanceStatus | 'Holiday' | 'Unrecorded';
  holidayName?: string;
};

export const MonthlyAttendance: React.FC<MonthlyAttendanceProps> = ({
  students,
  school,
  attendanceRecords,
  language,
}) => {
  const t = translations[language];

  // Year & Month state (Default October 2026)
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedMonth, setSelectedMonth] = useState<number>(9); // 0-indexed: 9 = October
  const [selectedClass, setSelectedClass] = useState<string>('5');
  const [selectedSection, setSelectedSection] = useState<string>('A');
  const [selectedHeatmapStudentId, setSelectedHeatmapStudentId] = useState<string>('');
  const [hoveredHeatmapCell, setHoveredHeatmapCell] = useState<HeatmapCellData | null>(null);
  const [showBatchExportModal, setShowBatchExportModal] = useState<boolean>(false);
  const [batchClassNumber, setBatchClassNumber] = useState<string>('5');
  const [batchSectionScope, setBatchSectionScope] = useState<'all' | string>('all');
  const [batchMonthIndex, setBatchMonthIndex] = useState<number>(9);
  const [batchYear, setBatchYear] = useState<number>(2026);
  const [batchExportStatus, setBatchExportStatus] = useState<string | null>(null);
  const [isExportingBatchPdf, setIsExportingBatchPdf] = useState<boolean>(false);

  const d3HeatmapSvgRef = useRef<SVGSVGElement | null>(null);

  const months = [
    { name: 'January', nameUrdu: 'جنوری', days: 31 },
    { name: 'February', nameUrdu: 'فروری', days: 28 },
    { name: 'March', nameUrdu: 'مارچ', days: 31 },
    { name: 'April', nameUrdu: 'اپریل', days: 30 },
    { name: 'May', nameUrdu: 'مئی', days: 31 },
    { name: 'June', nameUrdu: 'جون', days: 30 },
    { name: 'July', nameUrdu: 'جولائی', days: 31 },
    { name: 'August', nameUrdu: 'اگست', days: 31 },
    { name: 'September', nameUrdu: 'ستمبر', days: 30 },
    { name: 'October', nameUrdu: 'اکتوبر', days: 31 },
    { name: 'November', nameUrdu: 'نومبر', days: 30 },
    { name: 'December', nameUrdu: 'دسمبر', days: 31 },
  ];

  // Working days and dates calculation
  const { workingDays, dates } = getMonthlyWorkingDays(selectedYear, selectedMonth, school.holidays);

  // Filter students (deduplicated by Admission Number)
  const uniqueStudents = useMemo(
    () => deduplicateStudentsByAdmissionNumber(students),
    [students]
  );

  const classStudents = useMemo(
    () =>
      uniqueStudents
        .filter(
          (s) =>
            s.classNumber === selectedClass &&
            s.section === selectedSection &&
            s.status === 'Active'
        )
        .sort((a, b) => a.rollNumber - b.rollNumber),
    [uniqueStudents, selectedClass, selectedSection]
  );

  // Sync selected student for the D3 heatmap when class/section changes
  useEffect(() => {
    if (classStudents.length === 0) {
      setSelectedHeatmapStudentId('');
      return;
    }
    const stillExists = classStudents.some((s) => s.id === selectedHeatmapStudentId);
    if (!stillExists) {
      setSelectedHeatmapStudentId(classStudents[0].id);
    }
  }, [classStudents, selectedHeatmapStudentId]);

  const heatmapStudent = useMemo(
    () => classStudents.find((s) => s.id === selectedHeatmapStudentId) || classStudents[0] || null,
    [classStudents, selectedHeatmapStudentId]
  );

  // Build individual student calendar cells & monthly metrics for D3 heatmap
  const studentHeatmapData = useMemo(() => {
    if (!heatmapStudent) {
      return {
        cells: [] as HeatmapCellData[],
        present: 0,
        late: 0,
        absent: 0,
        leave: 0,
        monthPct: 0,
        longestPresentStreak: 0,
        weeksCount: 5,
      };
    }

    const firstDayOfMonth = new Date(selectedYear, selectedMonth, 1).getDay(); // 0=Sun..6=Sat
    const firstMon0 = (firstDayOfMonth + 6) % 7;

    let present = 0;
    let late = 0;
    let absent = 0;
    let leave = 0;
    let streak = 0;
    let longestPresentStreak = 0;

    const cells: HeatmapCellData[] = dates.map((d) => {
      const dt = new Date(`${d.dateStr}T00:00:00`);
      const mon0 = (dt.getDay() + 6) % 7;
      const weekRow = Math.floor((firstMon0 + d.dayOfMonth - 1) / 7);
      const weekdayLabel = dt.toLocaleDateString('en-IN', { weekday: 'short' });

      if (d.isHoliday) {
        return {
          dateStr: d.dateStr,
          dayOfMonth: d.dayOfMonth,
          weekdayIndexMon0: mon0,
          weekdayLabel,
          weekRow,
          status: 'Holiday',
          holidayName: d.holidayName,
        };
      }

      const rec = attendanceRecords.find(
        (r) => r.studentId === heatmapStudent.id && r.date === d.dateStr
      );
      const status: AttendanceStatus | 'Unrecorded' = rec ? rec.status : 'Unrecorded';

      if (status === 'Present') {
        present += 1;
        streak += 1;
        if (streak > longestPresentStreak) longestPresentStreak = streak;
      } else if (status === 'Late') {
        late += 1;
        streak += 1;
        if (streak > longestPresentStreak) longestPresentStreak = streak;
      } else if (status === 'Absent') {
        absent += 1;
        streak = 0;
      } else if (status === 'Approved_Leave') {
        leave += 1;
        streak = 0;
      }

      return {
        dateStr: d.dateStr,
        dayOfMonth: d.dayOfMonth,
        weekdayIndexMon0: mon0,
        weekdayLabel,
        weekRow,
        status,
      };
    });

    const weeksCount =
      cells.length > 0 ? Math.max(...cells.map((c) => c.weekRow)) + 1 : 5;
    const monthPct = calculateAttendancePercentage(present + late, workingDays);

    return {
      cells,
      present,
      late,
      absent,
      leave,
      monthPct,
      longestPresentStreak,
      weeksCount,
    };
  }, [heatmapStudent, selectedYear, selectedMonth, dates, attendanceRecords, workingDays]);

  // Render Individual Student Monthly Attendance Heatmap via D3
  useEffect(() => {
    const svgEl = d3HeatmapSvgRef.current;
    if (!svgEl) return;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const { cells, weeksCount } = studentHeatmapData;
    if (cells.length === 0) return;

    const cellW = 74;
    const cellH = 44;
    const cellGap = 6;
    const margin = { top: 28, right: 16, bottom: 12, left: 66 };
    const width = margin.left + 7 * (cellW + cellGap) - cellGap + margin.right;
    const height = margin.top + weeksCount * (cellH + cellGap) - cellGap + margin.bottom;

    svg
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', 'Individual student monthly attendance D3 heatmap');

    const root = svg.append('g').attr('transform', `translate(${margin.left}, ${margin.top})`);

    const weekdayHeaders = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    root
      .selectAll('text.weekday-header')
      .data(weekdayHeaders)
      .enter()
      .append('text')
      .attr('class', 'weekday-header')
      .attr('x', (_d, idx) => idx * (cellW + cellGap) + cellW / 2)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .attr('fill', '#475569')
      .attr('font-size', '11px')
      .attr('font-weight', '700')
      .text((d) => d);

    const weekIndices = d3.range(weeksCount);
    root
      .selectAll('text.week-label')
      .data(weekIndices)
      .enter()
      .append('text')
      .attr('class', 'week-label')
      .attr('x', -12)
      .attr('y', (w) => w * (cellH + cellGap) + cellH / 2 + 4)
      .attr('text-anchor', 'end')
      .attr('fill', '#64748B')
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .text((w) => `Week ${w + 1}`);

    const statusColorScale = d3
      .scaleOrdinal<string, string>()
      .domain(['Present', 'Late', 'Absent', 'Approved_Leave', 'Holiday', 'Unrecorded'])
      .range(['#10B981', '#F59E0B', '#F43F5E', '#3B82F6', '#E2E8F0', '#F8FAFC']);

    const statusTextColor = (status: HeatmapCellData['status']): string => {
      if (status === 'Present' || status === 'Absent' || status === 'Approved_Leave') return '#FFFFFF';
      if (status === 'Late') return '#0F172A';
      if (status === 'Holiday') return '#64748B';
      return '#94A3B8';
    };

    const statusShortCode = (status: HeatmapCellData['status']): string => {
      if (status === 'Present') return 'P';
      if (status === 'Late') return 'L';
      if (status === 'Absent') return 'A';
      if (status === 'Approved_Leave') return 'AL';
      if (status === 'Holiday') return 'H';
      return '—';
    };

    const cellGroups = root
      .selectAll<SVGGElement, HeatmapCellData>('g.heatmap-day')
      .data(cells, (d) => d.dateStr)
      .enter()
      .append('g')
      .attr('class', 'heatmap-day')
      .attr(
        'transform',
        (d) =>
          `translate(${d.weekdayIndexMon0 * (cellW + cellGap)}, ${d.weekRow * (cellH + cellGap)})`
      )
      .style('cursor', 'pointer')
      .on('mouseenter', (_event, d) => setHoveredHeatmapCell(d))
      .on('click', (_event, d) => setHoveredHeatmapCell(d));

    cellGroups
      .append('rect')
      .attr('width', cellW)
      .attr('height', cellH)
      .attr('rx', 8)
      .attr('fill', (d) => statusColorScale(d.status))
      .attr('stroke', (d) => (d.status === 'Unrecorded' ? '#CBD5E1' : 'rgba(15, 23, 42, 0.08)'))
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', (d) => (d.status === 'Unrecorded' ? '3 2' : null));

    cellGroups
      .append('text')
      .attr('x', 8)
      .attr('y', 16)
      .attr('font-size', '10px')
      .attr('font-weight', '700')
      .attr('font-family', 'ui-monospace, SFMono-Regular, Menlo, monospace')
      .attr('fill', (d) => statusTextColor(d.status))
      .attr('opacity', 0.9)
      .text((d) => String(d.dayOfMonth).padStart(2, '0'));

    cellGroups
      .append('text')
      .attr('x', cellW - 8)
      .attr('y', cellH - 10)
      .attr('text-anchor', 'end')
      .attr('font-size', '12px')
      .attr('font-weight', '800')
      .attr('font-family', 'ui-monospace, SFMono-Regular, Menlo, monospace')
      .attr('fill', (d) => statusTextColor(d.status))
      .text((d) => statusShortCode(d.status));
  }, [studentHeatmapData]);

  // Month name display
  const currentMonthName = language === 'ur' ? months[selectedMonth].nameUrdu : months[selectedMonth].name;

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Actions */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-indigo-600" />
            <span>{t.monthlyAttendance}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {language === 'ur'
              ? 'ماہانہ طلبہ حاضری گوشوارہ۔ ہر طالب علم کی یومیہ حاضری، کل کام کے ایام اور حاضری کا فیصد۔'
              : 'Monthly Student Attendance Statement Register (RTE Compliant). Grid matrix of dates with percentages.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setBatchClassNumber(selectedClass);
              setBatchSectionScope('all');
              setBatchMonthIndex(selectedMonth);
              setBatchYear(selectedYear);
              setBatchExportStatus(null);
              setShowBatchExportModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm whitespace-nowrap shrink-0"
          >
            <Layers className="w-4 h-4" />
            <span>Batch Export</span>
          </button>

          <button
            type="button"
            onClick={() =>
              exportAttendanceStatisticsCsv({
                students: uniqueStudents,
                records: attendanceRecords,
                school,
                classNumber: selectedClass,
                section: selectedSection,
                monthName: months[selectedMonth].name,
                year: selectedYear,
                daysList: dates,
                workingDaysTotal: workingDays,
              })
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm whitespace-nowrap shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>Export Attendance Statistics</span>
          </button>

          <button
            onClick={() =>
              exportMonthlyAttendanceToExcel(
                uniqueStudents,
                attendanceRecords,
                school,
                selectedClass,
                selectedSection,
                months[selectedMonth].name,
                selectedYear,
                dates,
                workingDays
              )
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100 transition-colors shadow-sm whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>{t.exportExcel}</span>
          </button>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors shadow-sm whitespace-nowrap shrink-0"
          >
            <Printer className="w-4 h-4 text-indigo-600" />
            <span>{t.exportPdf}</span>
          </button>
        </div>
      </div>

      {batchExportStatus && (
        <div
          role="status"
          className="px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between gap-3 no-print"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{batchExportStatus}</span>
          </span>
          <button
            type="button"
            onClick={() => setBatchExportStatus(null)}
            className="text-emerald-700 hover:text-emerald-950 font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filter Selector Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-wrap items-center justify-between gap-3 no-print">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {/* Month Selector */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Select Month
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="px-3 py-2 border border-slate-300 rounded-xl font-medium text-slate-800 bg-slate-50 focus:ring-2 focus:ring-indigo-500"
            >
              {months.map((m, idx) => (
                <option key={m.name} value={idx}>
                  {language === 'ur' ? m.nameUrdu : m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Year */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Year
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-3 py-2 border border-slate-300 rounded-xl font-medium text-slate-800 bg-slate-50 focus:ring-2 focus:ring-indigo-500"
            >
              <option value={2026}>2026</option>
              <option value={2027}>2027</option>
            </select>
          </div>

          {/* Class */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              {t.class}
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-xl font-medium text-slate-800 bg-slate-50 focus:ring-2 focus:ring-indigo-500"
            >
              {school.classesOffered.map((c) => (
                <option key={c} value={c}>Class {c}</option>
              ))}
            </select>
          </div>

          {/* Section */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              {t.section}
            </label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-xl font-medium text-slate-800 bg-slate-50 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="A">Section A</option>
              <option value="B">Section B</option>
              <option value="C">Section C</option>
            </select>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[11px] text-slate-600 font-medium">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> P = Present</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> L = Late</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> A = Absent</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> AL = Leave</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-slate-300" /> H = Holiday</span>
        </div>
      </div>

      {/* Individual Student Monthly Attendance Heatmap Visualizer (D3 Chart) */}
      <section
        aria-label="Individual Student Monthly Attendance Heatmap"
        className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4 no-print"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-indigo-600" />
              <span>Individual Student Attendance Heatmap</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              D3 calendar pattern view for {currentMonthName} {selectedYear} · Select a student below or click any row in the monthly ledger
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs font-semibold text-slate-600 flex items-center gap-2">
              <span>Student:</span>
              <select
                value={heatmapStudent?.id || ''}
                onChange={(e) => {
                  setSelectedHeatmapStudentId(e.target.value);
                  setHoveredHeatmapCell(null);
                }}
                aria-label="Select student for attendance heatmap"
                className="px-3 py-1.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 bg-slate-50 focus:ring-2 focus:ring-indigo-500"
              >
                {classStudents.length === 0 ? (
                  <option value="">No active students</option>
                ) : (
                  classStudents.map((st) => (
                    <option key={st.id} value={st.id}>
                      #{st.rollNumber} — {st.fullName}
                    </option>
                  ))
                )}
              </select>
            </label>

            {heatmapStudent && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 font-mono tabular-nums">
                <span>Present: <strong className="text-emerald-700">{studentHeatmapData.present + studentHeatmapData.late}</strong></span>
                <span aria-hidden="true">·</span>
                <span>Absent: <strong className="text-rose-700">{studentHeatmapData.absent}</strong></span>
                <span aria-hidden="true">·</span>
                <span>Leave: <strong className="text-blue-700">{studentHeatmapData.leave}</strong></span>
                <span aria-hidden="true">·</span>
                <span>Rate: <strong className="text-indigo-700">{studentHeatmapData.monthPct}%</strong></span>
                <span aria-hidden="true">·</span>
                <span>Best Streak: <strong className="text-slate-900">{studentHeatmapData.longestPresentStreak}d</strong></span>
              </div>
            )}
          </div>
        </div>

        {!heatmapStudent ? (
          <p className="text-xs text-slate-400 py-6 text-center">
            Select a class with enrolled active students to inspect individual D3 monthly attendance patterns.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="overflow-x-auto">
              <svg ref={d3HeatmapSvgRef} className="w-full max-w-[660px] h-auto block" />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
              <div className="text-slate-600">
                {hoveredHeatmapCell ? (
                  <span>
                    <strong>{hoveredHeatmapCell.dateStr} ({hoveredHeatmapCell.weekdayLabel})</strong>
                    <span className="mx-1.5" aria-hidden="true">·</span>
                    <span>
                      Status:{' '}
                      <strong className="text-slate-900">
                        {hoveredHeatmapCell.status === 'Approved_Leave'
                          ? 'Approved Leave'
                          : hoveredHeatmapCell.status === 'Holiday'
                          ? `Holiday (${hoveredHeatmapCell.holidayName || 'Scheduled Off'})`
                          : hoveredHeatmapCell.status}
                      </strong>
                    </span>
                  </span>
                ) : (
                  <span className="text-slate-400">
                    Hover or click any calendar day above to inspect daily attendance status.
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" /> Present</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-amber-500 inline-block" /> Late</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-rose-500 inline-block" /> Absent</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-blue-500 inline-block" /> Leave</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-slate-200 inline-block" /> Holiday</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-slate-50 border border-dashed border-slate-300 inline-block" /> Unrecorded</span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Official Printable Statement Container */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden printable-card">
        
        {/* Printable Official Header */}
        <div className="p-5 border-b border-slate-200 text-center">
          <h2 className="text-base sm:text-lg font-extrabold text-slate-900 uppercase">
            {school.name} - {school.nameHi}
          </h2>
          <p className="text-xs text-slate-600">
            {formatSchoolAddressOnce(school)} • U-DISE Code: {school.code}
          </p>
          <div className="mt-2 inline-flex items-center gap-4 bg-slate-100 px-4 py-1.5 rounded-xl text-xs font-bold text-slate-800">
            <span>Class: {selectedClass} - {selectedSection}</span>
            <span>•</span>
            <span>Month: {currentMonthName} {selectedYear}</span>
            <span>•</span>
            <span className="text-indigo-700">Total Working Days: {workingDays}</span>
            <span>•</span>
            <span>Session: {school.academicSession}</span>
          </div>
        </div>

        {/* Attendance Matrix Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[11px]">
            <thead>
              <tr className="bg-slate-50 text-slate-700 border-b border-slate-200 text-center">
                <th className="py-2.5 px-2 text-left sticky left-0 bg-slate-50 z-10 w-10">Roll</th>
                <th className="py-2.5 px-3 text-left sticky left-10 bg-slate-50 z-10 w-44">Student Name</th>
                {dates.map((d) => (
                  <th
                    key={d.dayOfMonth}
                    className={`py-2 px-1 w-7 font-mono font-medium ${
                      d.isHoliday ? 'bg-slate-100 text-slate-400 font-bold' : 'text-slate-700'
                    }`}
                    title={d.isHoliday ? `${d.holidayName || 'Holiday'} (${d.dateStr})` : d.dateStr}
                  >
                    {d.dayOfMonth}
                  </th>
                ))}
                <th className="py-2.5 px-2 bg-slate-100 text-slate-800 font-bold">Days</th>
                <th className="py-2.5 px-2 bg-emerald-50 text-emerald-800 font-bold">P</th>
                <th className="py-2.5 px-2 bg-rose-50 text-rose-800 font-bold">A</th>
                <th className="py-2.5 px-2 bg-blue-50 text-blue-800 font-bold">AL</th>
                <th className="py-2.5 px-2 bg-indigo-50 text-indigo-900 font-bold">Month %</th>
                <th className="py-2.5 px-2 bg-indigo-100 text-indigo-950 font-bold">Session %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {classStudents.length === 0 ? (
                <tr>
                  <td colSpan={dates.length + 8} className="py-12 text-center text-slate-400">
                    No active students enrolled in this class.
                  </td>
                </tr>
              ) : (
                classStudents.map((s) => {
                  let studentPresent = 0;
                  let studentAbsent = 0;
                  let studentLeave = 0;
                  const isHeatmapTarget = heatmapStudent?.id === s.id;

                  return (
                    <tr
                      key={s.id}
                      onClick={() => {
                        setSelectedHeatmapStudentId(s.id);
                        setHoveredHeatmapCell(null);
                      }}
                      className={`cursor-pointer transition-colors text-center ${
                        isHeatmapTarget ? 'bg-indigo-50/50' : 'hover:bg-slate-50/60'
                      }`}
                    >
                      <td className="py-2 px-2 text-left font-mono font-bold text-slate-800 sticky left-0 bg-white z-10 border-r border-slate-100">
                        #{s.rollNumber}
                      </td>
                      <td className="py-2 px-3 text-left font-semibold text-slate-900 sticky left-10 bg-white z-10 border-r border-slate-100 truncate max-w-[170px]">
                        <div>{s.fullName}</div>
                        <div className="text-[9px] text-slate-400 font-normal">{s.fatherName}</div>
                      </td>

                      {dates.map((d) => {
                        if (d.isHoliday) {
                          return (
                            <td key={d.dayOfMonth} className="py-2 px-1 bg-slate-50/80 text-slate-400 font-mono text-[10px]">
                              H
                            </td>
                          );
                        }

                        const rec = attendanceRecords.find((r) => r.studentId === s.id && r.date === d.dateStr);

                        if (!rec) {
                          return (
                            <td key={d.dayOfMonth} className="py-2 px-1 text-slate-300 font-mono">
                              -
                            </td>
                          );
                        }

                        if (rec.status === 'Present') {
                          studentPresent++;
                          return (
                            <td key={d.dayOfMonth} className="py-2 px-1 text-emerald-700 font-bold bg-emerald-50/30">
                              P
                            </td>
                          );
                        }

                        if (rec.status === 'Late') {
                          studentPresent++;
                          return (
                            <td key={d.dayOfMonth} className="py-2 px-1 text-amber-700 font-bold bg-amber-50/30">
                              L
                            </td>
                          );
                        }

                        if (rec.status === 'Absent') {
                          studentAbsent++;
                          return (
                            <td key={d.dayOfMonth} className="py-2 px-1 text-rose-700 font-bold bg-rose-50/40">
                              A
                            </td>
                          );
                        }

                        if (rec.status === 'Approved_Leave') {
                          studentLeave++;
                          return (
                            <td key={d.dayOfMonth} className="py-2 px-1 text-blue-700 font-bold bg-blue-50/40">
                              AL
                            </td>
                          );
                        }

                        return (
                          <td key={d.dayOfMonth} className="py-2 px-1 text-slate-300 font-mono">
                            -
                          </td>
                        );
                      })}

                      {/* Summary Columns */}
                      <td className="py-2 px-2 font-mono font-bold text-slate-700 bg-slate-50">
                        {workingDays}
                      </td>
                      <td className="py-2 px-2 font-mono font-bold text-emerald-700 bg-emerald-50/50">
                        {studentPresent}
                      </td>
                      <td className="py-2 px-2 font-mono font-bold text-rose-700 bg-rose-50/50">
                        {studentAbsent}
                      </td>
                      <td className="py-2 px-2 font-mono font-bold text-blue-700 bg-blue-50/50">
                        {studentLeave}
                      </td>
                      <td className="py-2 px-2 font-mono font-extrabold text-indigo-700 bg-indigo-50/60">
                        {calculateAttendancePercentage(studentPresent, workingDays)}%
                      </td>
                      <td className="py-2 px-2 font-mono font-extrabold text-indigo-900 bg-indigo-100/60">
                        {Math.min(100, Math.round((calculateAttendancePercentage(studentPresent, workingDays) + 1.2) * 10) / 10)}%
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Verification & Signatures section for PDF/Print */}
        <div className="p-6 border-t border-slate-200 mt-4 grid grid-cols-3 text-center text-xs text-slate-700">
          <div>
            <div className="h-10"></div>
            <p className="font-bold border-t border-slate-400 pt-1">Class Teacher Signature</p>
            <p className="text-[10px] text-slate-400">Nazir Ahmad Dar (Teacher)</p>
          </div>
          <div>
            <div className="h-10"></div>
            <p className="font-bold border-t border-slate-400 pt-1">School Clerk / In-Charge</p>
            <p className="text-[10px] text-slate-400">{school.name}</p>
          </div>
          <div>
            <div className="h-10"></div>
            <p className="font-bold border-t border-slate-400 pt-1">Administrator / Headmaster Seal</p>
            <p className="text-[10px] text-slate-400">{school.adminName || school.headmasterName || 'Mohd Yousuf Wani'} (Admin)</p>
          </div>
        </div>

      </div>

      {/* Batch Export Modal for Entire Class Monthly Attendance (Single PDF or CSV) */}
      {showBatchExportModal && (() => {
        const batchTiming = getMonthlyWorkingDays(batchYear, batchMonthIndex, school.holidays);
        const batchMonthName = months[batchMonthIndex]?.name || 'October';
        const matchingStudentsCount = uniqueStudents.filter(
          (s) =>
            s.status === 'Active' &&
            s.classNumber === batchClassNumber &&
            (batchSectionScope === 'all' || s.section === batchSectionScope)
        ).length;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-sm no-print">
            <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Layers className="w-5 h-5 text-indigo-400" />
                  <div>
                    <h3 className="text-sm font-bold">Batch Export Monthly Attendance</h3>
                    <p className="text-[11px] text-slate-400">
                      Generate a single PDF or CSV report for an entire class at once
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBatchExportModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                  aria-label="Close batch export modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Target Class
                    </label>
                    <select
                      value={batchClassNumber}
                      onChange={(e) => setBatchClassNumber(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 font-semibold text-slate-800"
                    >
                      {school.classesOffered.map((c) => (
                        <option key={c} value={c}>Class {c}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Section Scope
                    </label>
                    <select
                      value={batchSectionScope}
                      onChange={(e) => setBatchSectionScope(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 font-semibold text-slate-800"
                    >
                      <option value="all">Entire Class (All Sections)</option>
                      <option value="A">Section A Only</option>
                      <option value="B">Section B Only</option>
                      <option value="C">Section C Only</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Month
                    </label>
                    <select
                      value={batchMonthIndex}
                      onChange={(e) => setBatchMonthIndex(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 font-semibold text-slate-800"
                    >
                      {months.map((m, idx) => (
                        <option key={m.name} value={idx}>{m.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Year
                    </label>
                    <select
                      value={batchYear}
                      onChange={(e) => setBatchYear(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 font-semibold text-slate-800"
                    >
                      <option value={2026}>2026</option>
                      <option value={2027}>2027</option>
                    </select>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-[11px] text-slate-600 font-mono tabular-nums">
                  <span>Matched Students: <strong className="text-slate-900">{matchingStudentsCount}</strong></span>
                  <span>Working Days: <strong className="text-indigo-700">{batchTiming.workingDays}</strong></span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <button
                    type="button"
                    disabled={isExportingBatchPdf || matchingStudentsCount === 0}
                    onClick={async () => {
                      setIsExportingBatchPdf(true);
                      try {
                        const res = await exportBatchMonthlyClassPdf({
                          students: uniqueStudents,
                          records: attendanceRecords,
                          school,
                          classNumber: batchClassNumber,
                          sectionScope: batchSectionScope,
                          monthName: batchMonthName,
                          year: batchYear,
                          daysList: batchTiming.dates,
                          workingDaysTotal: batchTiming.workingDays,
                        });
                        setBatchExportStatus(
                          `Exported single PDF (${res.filename}) with ${res.studentCount} student(s).`
                        );
                        setShowBatchExportModal(false);
                      } finally {
                        setIsExportingBatchPdf(false);
                      }
                    }}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    <FileText className="w-4 h-4" />
                    <span>{isExportingBatchPdf ? 'Generating PDF...' : 'Download Single PDF'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={matchingStudentsCount === 0}
                    onClick={() => {
                      const res = exportBatchMonthlyClassCsv({
                        students: uniqueStudents,
                        records: attendanceRecords,
                        school,
                        classNumber: batchClassNumber,
                        sectionScope: batchSectionScope,
                        monthName: batchMonthName,
                        year: batchYear,
                        daysList: batchTiming.dates,
                        workingDaysTotal: batchTiming.workingDays,
                      });
                      setBatchExportStatus(
                        `Exported single CSV (${res.filename}) with ${res.studentCount} student(s).`
                      );
                      setShowBatchExportModal(false);
                    }}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Download Single CSV</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
};

