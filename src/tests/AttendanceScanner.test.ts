import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import type { AttendanceRecord, Student } from '../types';

const mockGetCameras = jest.fn();
const mockStart = jest.fn();
const mockStop = jest.fn();
const mockClear = jest.fn();

let capturedOnDecodeSuccess: ((decodedText: string) => void) | null = null;
let mockInstanceIsScanning = false;

jest.mock('html5-qrcode', () => {
  class MockHtml5Qrcode {
    static getCameras = (...args: unknown[]) => mockGetCameras(...args);

    get isScanning(): boolean {
      return mockInstanceIsScanning;
    }

    start(
      _cameraConfig: unknown,
      _qrConfig: unknown,
      onSuccess: (decodedText: string) => void,
      _onFailure: () => void
    ) {
      capturedOnDecodeSuccess = onSuccess;
      mockInstanceIsScanning = true;
      return mockStart(_cameraConfig, _qrConfig, onSuccess, _onFailure);
    }

    stop() {
      mockInstanceIsScanning = false;
      return mockStop();
    }

    clear() {
      return mockClear();
    }
  }

  return { Html5Qrcode: MockHtml5Qrcode };
});

// Load component after html5-qrcode mock is registered
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { AttendanceScanner } = require('../components/AttendanceScanner') as typeof import('../components/AttendanceScanner');

function makeTestStudent(idx: number): Student {
  return {
    id: `SM-TEST-00${idx}`,
    admissionNumber: `ADM-2026-00${idx}`,
    fullName: `Student ${idx} Name`,
    fatherName: `Father ${idx}`,
    motherName: `Mother ${idx}`,
    gender: idx % 2 === 0 ? 'Female' : 'Male',
    dob: '2015-05-10',
    classNumber: '5',
    section: 'A',
    rollNumber: idx,
    academicSession: '2026-2027',
    address: 'Pamposh Colony, Srinagar',
    villageTown: 'Pamposh Colony',
    blockTehsil: 'Srinagar',
    district: 'Srinagar',
    state: 'Jammu and Kashmir',
    pinCode: '190017',
    mobileNumber: `980000000${idx}`,
    parentWhatsAppNumber: `980000000${idx}`,
    admissionDate: '2026-04-01',
    status: 'Active',
    aadhaarStatus: 'Verified',
  };
}

const testStudents: Student[] = [1, 2, 3, 4, 5, 6].map(makeTestStudent);

describe('AttendanceScanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    capturedOnDecodeSuccess = null;
    mockInstanceIsScanning = false;
    mockGetCameras.mockResolvedValue([{ id: 'cam-rear-1', label: 'Back Camera' }]);
    mockStart.mockResolvedValue(undefined);
    mockStop.mockResolvedValue(undefined);
    mockClear.mockReturnValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('requests camera permissions on mount and starts the viewfinder stream', async () => {
    const onScanSuccess = jest.fn();

    render(
      React.createElement(AttendanceScanner, {
        students: testStudents,
        classStudents: testStudents,
        selectedClass: '5',
        selectedSection: 'A',
        draftStatus: {},
        onScanSuccess,
      })
    );

    await waitFor(() => {
      expect(mockGetCameras).toHaveBeenCalledTimes(1);
      expect(mockStart).toHaveBeenCalledTimes(1);
    });

    expect(mockStart.mock.calls[0][0]).toEqual({ deviceId: { exact: 'cam-rear-1' } });
  });

  it('renders a clear permission denied fallback when camera access is rejected', async () => {
    const permError = new Error('Permission denied by user');
    permError.name = 'NotAllowedError';
    mockGetCameras.mockRejectedValueOnce(permError);

    render(
      React.createElement(AttendanceScanner, {
        students: testStudents,
        selectedClass: '5',
        selectedSection: 'A',
        onScanSuccess: jest.fn(),
      })
    );

    await waitFor(() => {
      expect(screen.getByText('Camera Permission Required')).toBeInTheDocument();
    });
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('parses a scanned student QR payload, dispatches attendance update, and pauses in single-shot mode', async () => {
    const onScanSuccess = jest.fn();

    render(
      React.createElement(AttendanceScanner, {
        students: testStudents,
        classStudents: testStudents,
        selectedClass: '5',
        selectedSection: 'A',
        defaultContinuousScanning: false,
        onScanSuccess,
      })
    );

    await waitFor(() => {
      expect(capturedOnDecodeSuccess).not.toBeNull();
    });

    const sevenFieldPayload = [
      '1. Student Name: Student 1 Name',
      '4. Admission Number: ADM-2026-001',
    ].join('\n');

    act(() => {
      capturedOnDecodeSuccess?.(sevenFieldPayload);
    });

    expect(onScanSuccess).toHaveBeenCalledTimes(1);
    expect(onScanSuccess).toHaveBeenCalledWith(testStudents[0], sevenFieldPayload);

    await waitFor(() => {
      expect(mockStop).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText('Single-Shot Scan Complete')).toBeInTheDocument();

    const recentSection = screen.getByTestId('recent-scans-list');
    expect(within(recentSection).getByText('Student 1 Name')).toBeInTheDocument();
  });

  it('keeps camera active and shows a brief success toast when Continuous Scanning toggle is enabled', async () => {
    const onScanSuccess = jest.fn();

    render(
      React.createElement(AttendanceScanner, {
        students: testStudents,
        classStudents: testStudents,
        selectedClass: '5',
        selectedSection: 'A',
        onScanSuccess,
      })
    );

    await waitFor(() => {
      expect(capturedOnDecodeSuccess).not.toBeNull();
    });

    jest.useFakeTimers();

    const toggleSwitch = screen.getByRole('switch', { name: /continuous scanning/i });
    expect(toggleSwitch).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(toggleSwitch);
    expect(toggleSwitch).toHaveAttribute('aria-checked', 'true');

    act(() => {
      capturedOnDecodeSuccess?.('ADM-2026-002');
    });

    expect(onScanSuccess).toHaveBeenCalledWith(testStudents[1], 'ADM-2026-002');
    expect(mockStop).not.toHaveBeenCalled();

    const toastOverlay = screen.getByTestId('continuous-scan-toast');
    expect(toastOverlay).toHaveTextContent('Present: Student 2 Name');

    // Immediate next scan succeeds without stopping/resetting the camera
    act(() => {
      capturedOnDecodeSuccess?.('ADM-2026-003');
    });

    expect(onScanSuccess).toHaveBeenCalledTimes(2);
    expect(onScanSuccess).toHaveBeenLastCalledWith(testStudents[2], 'ADM-2026-003');
    expect(mockStop).not.toHaveBeenCalled();
    expect(screen.getByTestId('continuous-scan-toast')).toHaveTextContent('Present: Student 3 Name');

    // Brief toast auto-dismisses after timeout
    act(() => {
      jest.advanceTimersByTime(2500);
    });

    expect(screen.queryByTestId('continuous-scan-toast')).not.toBeInTheDocument();
  });

  it('displays only the last 5 successfully scanned students in the Recent Scans list below the viewfinder', async () => {
    const onScanSuccess = jest.fn();

    render(
      React.createElement(AttendanceScanner, {
        students: testStudents,
        classStudents: testStudents,
        selectedClass: '5',
        selectedSection: 'A',
        defaultContinuousScanning: true,
        onScanSuccess,
      })
    );

    await waitFor(() => {
      expect(capturedOnDecodeSuccess).not.toBeNull();
    });

    for (const student of testStudents) {
      act(() => {
        capturedOnDecodeSuccess?.(student.admissionNumber);
      });
    }

    expect(onScanSuccess).toHaveBeenCalledTimes(6);

    const recentSection = screen.getByTestId('recent-scans-list');
    const items = within(recentSection).getAllByRole('listitem');
    expect(items).toHaveLength(5);

    // Most recent 5 (Students 6..2) should be shown; oldest (Student 1) evicted
    expect(within(recentSection).getByText('Student 6 Name')).toBeInTheDocument();
    expect(within(recentSection).getByText('Student 2 Name')).toBeInTheDocument();
    expect(within(recentSection).queryByText('Student 1 Name')).not.toBeInTheDocument();
  });

  it('displays real-time Students Scanned, Attendance Percentage Today, and Remaining to Scan metrics in the top summary card', async () => {
    render(
      React.createElement(AttendanceScanner, {
        students: testStudents,
        classStudents: testStudents,
        selectedClass: '5',
        selectedSection: 'A',
        selectedDate: '2026-10-28',
        draftStatus: {},
        defaultContinuousScanning: true,
        onScanSuccess: jest.fn(),
      })
    );

    await waitFor(() => {
      expect(capturedOnDecodeSuccess).not.toBeNull();
    });

    const summaryCard = screen.getByTestId('scanner-stats-summary');
    expect(within(summaryCard).getByText('Students Scanned')).toBeInTheDocument();
    expect(within(summaryCard).getByText('Attendance Percentage Today')).toBeInTheDocument();
    expect(within(summaryCard).getByText('Remaining to Scan')).toBeInTheDocument();
    expect(within(summaryCard).getByText('0%')).toBeInTheDocument();

    // Scan 3 out of 6 students -> 3 scanned, 50% today, 3 remaining
    act(() => {
      capturedOnDecodeSuccess?.('ADM-2026-001');
      capturedOnDecodeSuccess?.('ADM-2026-002');
      capturedOnDecodeSuccess?.('ADM-2026-003');
    });

    expect(within(summaryCard).getByText('50%')).toBeInTheDocument();
    expect(within(summaryCard).getByText('(3 present)')).toBeInTheDocument();
  });

  it('switches to the View History tab within Recent Scans to show previous-day attendance records', async () => {
    const mockHistoryRecords: AttendanceRecord[] = [
      {
        id: 'att-prev-1',
        date: '2026-10-27',
        studentId: 'SM-TEST-001',
        classNumber: '5',
        section: 'A',
        status: 'Present',
        academicSession: '2026-2027',
        markedByUserId: 'teacher-1',
        markedAt: '2026-10-27T09:05:00Z',
      },
      {
        id: 'att-prev-2',
        date: '2026-10-26',
        studentId: 'SM-TEST-002',
        classNumber: '5',
        section: 'A',
        status: 'Absent',
        academicSession: '2026-2027',
        markedByUserId: 'teacher-1',
        markedAt: '2026-10-26T09:10:00Z',
      },
      {
        id: 'att-today-only',
        date: '2026-10-28',
        studentId: 'SM-TEST-003',
        classNumber: '5',
        section: 'A',
        status: 'Present',
        academicSession: '2026-2027',
        markedByUserId: 'teacher-1',
        markedAt: '2026-10-28T09:00:00Z',
      },
    ];

    render(
      React.createElement(AttendanceScanner, {
        students: testStudents,
        classStudents: testStudents,
        attendanceRecords: mockHistoryRecords,
        selectedDate: '2026-10-28',
        selectedClass: '5',
        selectedSection: 'A',
        onScanSuccess: jest.fn(),
      })
    );

    await waitFor(() => {
      expect(mockGetCameras).toHaveBeenCalledTimes(1);
    });

    const recentSection = screen.getByTestId('recent-scans-list');
    const historyTab = within(recentSection).getByRole('tab', { name: /view history/i });
    fireEvent.click(historyTab);

    const historyContainer = screen.getByTestId('previous-scans-history');
    expect(within(historyContainer).getByText('Student 1 Name')).toBeInTheDocument();
    expect(within(historyContainer).getByText('Student 2 Name')).toBeInTheDocument();
    // Current day record (2026-10-28) should not appear in previous-day history logs
    expect(within(historyContainer).queryByText('Student 3 Name')).not.toBeInTheDocument();
  });

  it('automatically triggers background sync when Auto-Sync is enabled and network connectivity is available', async () => {
    const onTriggerBackgroundSync = jest.fn().mockResolvedValue(undefined);
    const onScanSuccess = jest.fn();

    const { rerender } = render(
      React.createElement(AttendanceScanner, {
        students: testStudents,
        classStudents: testStudents,
        selectedClass: '5',
        selectedSection: 'A',
        selectedDate: '2026-10-28',
        isOffline: true,
        defaultContinuousScanning: true,
        onTriggerBackgroundSync,
        onScanSuccess,
      })
    );

    await waitFor(() => {
      expect(capturedOnDecodeSuccess).not.toBeNull();
    });

    const autoSyncSwitch = screen.getByRole('switch', { name: /auto-sync/i });
    expect(autoSyncSwitch).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(autoSyncSwitch);
    expect(autoSyncSwitch).toHaveAttribute('aria-checked', 'true');

    // Scan while offline: queued locally without syncing yet
    act(() => {
      capturedOnDecodeSuccess?.('ADM-2026-004');
    });

    expect(onScanSuccess).toHaveBeenCalledTimes(1);
    expect(onTriggerBackgroundSync).not.toHaveBeenCalled();

    // Restore network connection -> background sync should fire automatically
    rerender(
      React.createElement(AttendanceScanner, {
        students: testStudents,
        classStudents: testStudents,
        selectedClass: '5',
        selectedSection: 'A',
        selectedDate: '2026-10-28',
        isOffline: false,
        defaultContinuousScanning: true,
        onTriggerBackgroundSync,
        onScanSuccess,
      })
    );

    await waitFor(() => {
      expect(onTriggerBackgroundSync).toHaveBeenCalledTimes(1);
    });
    expect(onTriggerBackgroundSync.mock.calls[0][0]).toHaveLength(1);
    expect(onTriggerBackgroundSync.mock.calls[0][0][0].studentId).toBe('SM-TEST-004');
  });

  it('persists QR scan records in the Scan Logs database tab across remounts and filters by student, class, and date range', async () => {
    const class6Student: Student = {
      ...makeTestStudent(9),
      id: 'SM-TEST-009',
      admissionNumber: 'ADM-2026-009',
      fullName: 'Zoya Khan',
      classNumber: '6',
      section: 'B',
      rollNumber: 9,
    };
    const multiClassStudents = [...testStudents, class6Student];

    const historicalSeed: AttendanceRecord[] = [
      {
        id: 'att-seed-old',
        date: '2026-10-12',
        studentId: 'SM-TEST-001',
        classNumber: '5',
        section: 'A',
        status: 'Present',
        academicSession: '2026-2027',
        markedByUserId: 'teacher-1',
        markedAt: '2026-10-12T09:05:00.000Z',
      },
    ];

    const { unmount } = render(
      React.createElement(AttendanceScanner, {
        students: multiClassStudents,
        classStudents: multiClassStudents,
        attendanceRecords: historicalSeed,
        selectedDate: '2026-10-28',
        defaultContinuousScanning: true,
        onScanSuccess: jest.fn(),
      })
    );

    await waitFor(() => {
      expect(capturedOnDecodeSuccess).not.toBeNull();
    });

    // Scan one student from Class 5 and one from Class 6 on 2026-10-28
    act(() => {
      capturedOnDecodeSuccess?.('ADM-2026-002');
      capturedOnDecodeSuccess?.('ADM-2026-009');
    });

    // Unmount and remount to verify persistence across reloads/mounts
    unmount();

    render(
      React.createElement(AttendanceScanner, {
        students: multiClassStudents,
        classStudents: multiClassStudents,
        attendanceRecords: historicalSeed,
        selectedDate: '2026-10-28',
        onScanSuccess: jest.fn(),
      })
    );

    await waitFor(() => {
      expect(mockGetCameras).toHaveBeenCalled();
    });

    const recentSection = screen.getByTestId('recent-scans-list');
    const scanLogsTab = within(recentSection).getByRole('tab', { name: /scan logs/i });
    fireEvent.click(scanLogsTab);

    const logsPanel = screen.getByTestId('scan-logs-database');
    expect(within(logsPanel).getByText('Student 2 Name')).toBeInTheDocument();
    expect(within(logsPanel).getByText('Zoya Khan')).toBeInTheDocument();
    expect(within(logsPanel).getByText('Student 1 Name')).toBeInTheDocument();

    // Filter by student search
    const searchInput = within(logsPanel).getByLabelText('Search scan logs by student');
    fireEvent.change(searchInput, { target: { value: 'Zoya' } });
    expect(within(logsPanel).getByText('Zoya Khan')).toBeInTheDocument();
    expect(within(logsPanel).queryByText('Student 2 Name')).not.toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: '' } });

    // Filter by class
    const classSelect = within(logsPanel).getByLabelText('Filter scan logs by class');
    fireEvent.change(classSelect, { target: { value: '5' } });
    expect(within(logsPanel).getByText('Student 2 Name')).toBeInTheDocument();
    expect(within(logsPanel).queryByText('Zoya Khan')).not.toBeInTheDocument();

    fireEvent.change(classSelect, { target: { value: 'all' } });

    // Filter by date range
    const fromInput = within(logsPanel).getByLabelText('Filter scan logs from date');
    const toInput = within(logsPanel).getByLabelText('Filter scan logs to date');
    fireEvent.change(fromInput, { target: { value: '2026-10-10' } });
    fireEvent.change(toInput, { target: { value: '2026-10-15' } });
    expect(within(logsPanel).getByText('Student 1 Name')).toBeInTheDocument();
    expect(within(logsPanel).queryByText('Zoya Khan')).not.toBeInTheDocument();
  });
});
