/**
 * Utility to export Recharts SVG visualizations to high-resolution PNG images
 * with an official School Master administrative header banner and timestamp.
 */

interface ExportChartOptions {
  containerEl: HTMLElement | null;
  schoolName: string;
  schoolCode: string;
  academicSession: string;
  classLabel: string;
  metricLabel: string;
  language: 'en' | 'ur';
  filenamePrefix?: string;
}

export async function exportChartToPng(options: ExportChartOptions): Promise<boolean> {
  const {
    containerEl,
    schoolName,
    schoolCode,
    academicSession,
    classLabel,
    metricLabel,
    language,
    filenamePrefix = 'Attendance_Trends',
  } = options;

  if (!containerEl) {
    console.error('Export error: Container element not found');
    return false;
  }

  const svgEl = containerEl.querySelector('svg');
  if (!svgEl) {
    console.error('Export error: SVG element not found in container');
    return false;
  }

  try {
    // 1. Clone SVG to avoid modifying the DOM
    const clonedSvg = svgEl.cloneNode(true) as SVGSVGElement;

    // Ensure viewBox and dimensions
    const svgRect = svgEl.getBoundingClientRect();
    const width = svgRect.width || 600;
    const height = svgRect.height || 280;

    clonedSvg.setAttribute('width', String(width));
    clonedSvg.setAttribute('height', String(height));
    if (!clonedSvg.getAttribute('viewBox')) {
      clonedSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    }
    clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

    // Inline computed styles for text elements to preserve font rendering
    const originalTexts = svgEl.querySelectorAll('text');
    const clonedTexts = clonedSvg.querySelectorAll('text');
    clonedTexts.forEach((ct, i) => {
      const orig = originalTexts[i];
      if (orig) {
        const computed = window.getComputedStyle(orig);
        ct.style.fontFamily = computed.fontFamily || 'sans-serif';
        ct.style.fontSize = computed.fontSize || '11px';
        ct.style.fill = computed.fill || '#64748B';
      }
    });

    // 2. Serialize SVG to Data URL
    const svgString = new XMLSerializer().serializeToString(clonedSvg);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const blobUrl = URL.createObjectURL(svgBlob);

    // 3. Load SVG as an Image
    const img = new Image();
    img.crossOrigin = 'anonymous';

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = (e) => reject(e);
      img.src = blobUrl;
    });

    // 4. Setup 2x Canvas for Retina crispness
    const scale = 2;
    const headerHeight = 110;
    const footerHeight = 45;
    const padding = 20;

    const totalWidth = width + padding * 2;
    const totalHeight = height + headerHeight + footerHeight;

    const canvas = document.createElement('canvas');
    canvas.width = totalWidth * scale;
    canvas.height = totalHeight * scale;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      URL.revokeObjectURL(blobUrl);
      return false;
    }

    ctx.scale(scale, scale);

    // Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, totalWidth, totalHeight);

    // Top Header Banner (Indigo gradient-like solid)
    ctx.fillStyle = '#1E1B4B'; // Indigo 950
    ctx.fillRect(0, 0, totalWidth, 80);

    // School Name & Code
    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 16px "Plus Jakarta Sans", Arial, sans-serif';
    ctx.fillText(schoolName, padding, 28);

    // Subtitle & U-DISE Code
    ctx.fillStyle = '#A5B4FC'; // Indigo 300
    ctx.font = '11px "Plus Jakarta Sans", Arial, sans-serif';
    const subTitle = `U-DISE Code: ${schoolCode}  •  Academic Session: ${academicSession}`;
    ctx.fillText(subTitle, padding, 46);

    // Report Title & Timestamp
    const todayStr = new Date().toISOString().slice(0, 10);
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    ctx.fillStyle = '#FDE68A'; // Amber 200
    ctx.font = 'bold 11px "Plus Jakarta Sans", Arial, sans-serif';
    const reportHeading = language === 'ur'
      ? `طلباء کی حاضری کا تجزیاتی گراف  |  تاریخ: ${todayStr}`
      : `STUDENT ATTENDANCE ANALYTICS INFOGRAPHIC  |  Exported: ${todayStr} ${timeStr}`;
    ctx.fillText(reportHeading, padding, 66);

    // Metadata Strip below header
    ctx.fillStyle = '#F1F5F9';
    ctx.fillRect(0, 80, totalWidth, 26);

    ctx.fillStyle = '#475569';
    ctx.font = '10px "Plus Jakarta Sans", Arial, sans-serif';
    const filterInfo = `Filter: ${classLabel}  |  Metric: ${metricLabel}  |  RTE Statutory Benchmark: 85% Mandate`;
    ctx.fillText(filterInfo, padding, 97);

    // Draw Chart Image
    ctx.drawImage(img, padding, headerHeight, width, height);

    // Footer divider & Verification text
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, totalHeight - footerHeight + 10);
    ctx.lineTo(totalWidth - padding, totalHeight - footerHeight + 10);
    ctx.stroke();

    ctx.fillStyle = '#64748B';
    ctx.font = '9px "Plus Jakarta Sans", Arial, sans-serif';
    const footerText = language === 'ur'
      ? 'اسمارٹ اسکول مینیجر - تصدیق شدہ تعلیمی پورٹل، حکومتِ ہند'
      : 'Smart School Manager • Official Academic Record Management System • Primary & Middle School Edition';
    ctx.fillText(footerText, padding, totalHeight - 16);

    URL.revokeObjectURL(blobUrl);

    // 5. Trigger PNG Download
    const filename = `SchoolMaster_${filenamePrefix}_${todayStr}.png`;
    const dataUrl = canvas.toDataURL('image/png');
    const downloadLink = document.createElement('a');
    downloadLink.href = dataUrl;
    downloadLink.download = filename;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    return true;
  } catch (error) {
    console.error('Failed to export chart to PNG:', error);
    return false;
  }
}
