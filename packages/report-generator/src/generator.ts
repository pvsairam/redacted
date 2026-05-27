/**
 * DOCX Report Generator
 *
 * Generates professional QA test execution reports in DOCX format.
 * The report should be clean and professional enough to send to a client.
 *
 * Report structure:
 * 1. Cover section
 * 2. Test summary table
 * 3. Environment details
 * 4. Step-by-step execution table with screenshots
 * 5. Failure section (if applicable)
 * 6. Footer with generation timestamp
 */

import * as fs from 'node:fs/promises';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  ImageRun,
  HeadingLevel,
  AlignmentType,
  WidthType,
  BorderStyle,
  ShadingType,
  PageBreak,
  Header,
  Footer,
  PageOrientation,
} from 'docx';
import type { TestRun, RecordedStep, StepExecutionResult } from '@qa-platform/shared';

export interface ReportInput {
  run: TestRun;
  steps: RecordedStep[];
  stepResults: StepExecutionResult[];
  screenshots: Array<{
    stepNumber: number | null;
    path: string;
    isFailure: boolean;
  }>;
  author: string;
  company: string;
}

export interface GenerateReportResult {
  buffer: Buffer;
  filename: string;
}

// ─── Color constants ───────────────────────────────────────────────────────────
const COLORS = {
  black: '0F172A',       // Slate 900
  darkGray: '334155',    // Slate 700
  medGray: '64748B',     // Slate 500
  lightGray: 'F8FAFC',   // Slate 50
  border: 'E2E8F0',      // Slate 200
  success: '16A34A',     // Green 600
  danger: 'DC2626',      // Red 600
  warning: 'D97706',     // Amber 600
  white: 'FFFFFF',
  primary: '1E3A8A',     // Dark Indigo/Blue
  accent: '2563EB',      // Royal Blue
};

// ─── Text helpers ─────────────────────────────────────────────────────────────

function boldText(text: string, size = 22, color = COLORS.black): TextRun {
  return new TextRun({ text, bold: true, size, color, font: 'Segoe UI' });
}

function normalText(text: string, size = 20, color = COLORS.darkGray): TextRun {
  return new TextRun({ text, size, color, font: 'Segoe UI' });
}

function labelText(text: string): TextRun {
  return new TextRun({ text, bold: true, size: 18, color: COLORS.medGray, font: 'Segoe UI' });
}

function truncateUrl(url: string, maxLength = 80): string {
  if (!url) return 'N/A';
  if (url.length <= maxLength) return url;
  return url.substring(0, maxLength) + '...';
}

// ─── Table helpers ────────────────────────────────────────────────────────────

function headerCell(text: string, percentWidth?: number): TableCell {
  const cellOptions: any = {
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            bold: true,
            size: 18,
            color: COLORS.white,
            font: 'Segoe UI',
          }),
        ],
      }),
    ],
    shading: { type: ShadingType.SOLID, color: COLORS.primary },
    margins: { top: 120, bottom: 120, left: 140, right: 140 },
  };

  if (percentWidth !== undefined) {
    cellOptions.width = { size: percentWidth * 50, type: WidthType.PERCENTAGE };
  }

  return new TableCell(cellOptions);
}

function dataCell(
  text: string,
  options: { bold?: boolean; color?: string; percentWidth?: number; shading?: string } = {},
): TableCell {
  const cellOptions: any = {
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            bold: options.bold ?? false,
            size: 18,
            color: options.color ?? COLORS.darkGray,
            font: 'Segoe UI',
          }),
        ],
      }),
    ],
    shading: { type: ShadingType.SOLID, color: options.shading ?? COLORS.white },
    margins: { top: 100, bottom: 100, left: 140, right: 140 },
  };

  if (options.percentWidth !== undefined) {
    cellOptions.width = { size: options.percentWidth * 50, type: WidthType.PERCENTAGE };
  }

  return new TableCell(cellOptions);
}

// ─── Image loading ────────────────────────────────────────────────────────────

async function loadImage(imgPath: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(imgPath);
  } catch {
    return null;
  }
}

// ─── Main generator ───────────────────────────────────────────────────────────

export async function generateReport(input: ReportInput): Promise<GenerateReportResult> {
  const { run, steps, stepResults, screenshots, author, company } = input;

  const generatedAt = new Date();
  const generatedAtStr = generatedAt.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  const startedAtStr = run.startedAt
    ? new Date(run.startedAt).toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'N/A';

  const durationStr = run.durationMs
    ? `${(run.durationMs / 1000).toFixed(1)}s`
    : 'N/A';

  const statusColor = run.status === 'passed' ? COLORS.success : COLORS.danger;
  const statusText = run.status.toUpperCase();

  // ─── Build step rows ────────────────────────────────────────────────────────

  const stepSections: (Paragraph | Table)[] = [];

  for (const step of steps) {
    const result = stepResults.find((r) => r.stepNumber === step.stepNumber);
    const screenshot = screenshots.find(
      (s) => s.stepNumber === step.stepNumber && !s.isFailure,
    );

    const resultColor =
      result?.result === 'passed'
        ? COLORS.success
        : result?.result === 'failed'
          ? COLORS.danger
          : COLORS.medGray;

    const resultLabel = result?.result?.toUpperCase() ?? 'PENDING';

    stepSections.push(
      new Table({
        width: { size: 5000, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
          left: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
          right: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
          insideVertical: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
        },
        rows: [
          new TableRow({
            children: [
              headerCell(`Step ${step.stepNumber}`, 50),
              headerCell('Action', 15),
              headerCell('Status', 20),
              headerCell('Duration', 15),
            ],
          }),
          new TableRow({
            children: [
              dataCell(step.title, { percentWidth: 50, bold: true }),
              dataCell(step.action, { percentWidth: 15 }),
              dataCell(resultLabel, { color: resultColor, bold: true, percentWidth: 20 }),
              dataCell(result ? `${result.durationMs}ms` : '-', { percentWidth: 15 }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({
                columnSpan: 4,
                children: [
                  new Paragraph({
                    children: [
                      labelText('URL: '),
                      normalText(truncateUrl(step.url)),
                    ],
                    spacing: { before: 40, after: 40 },
                  }),
                  new Paragraph({
                    children: [
                      labelText('Locator: '),
                      normalText(
                        `${step.locator.primary.strategy}="${step.locator.primary.value}"${
                          step.locator.primary.name ? ` name="${step.locator.primary.name}"` : ''
                        }`,
                      ),
                    ],
                    spacing: { before: 40, after: 40 },
                  }),
                  result?.errorMessage
                    ? new Paragraph({
                        children: [
                          labelText('Error: '),
                          new TextRun({
                            text: result.errorMessage,
                            size: 18,
                            color: COLORS.danger,
                            font: 'Segoe UI',
                          }),
                        ],
                        spacing: { before: 40, after: 40 },
                      })
                    : new Paragraph({ children: [] }),
                ],
                margins: { top: 100, bottom: 100, left: 140, right: 140 },
                shading: { type: ShadingType.SOLID, color: COLORS.lightGray },
              }),
            ],
          }),
        ],
      }),
    );

    // Add screenshot if available
    if (screenshot?.path) {
      const imgBuffer = await loadImage(screenshot.path);
      if (imgBuffer) {
        stepSections.push(
          new Paragraph({
            children: [
              new ImageRun({
                data: imgBuffer,
                transformation: { width: 820, height: 462 },
                type: 'png',
              }),
            ],
            spacing: { before: 120, after: 200 },
            alignment: AlignmentType.CENTER,
          }),
        );
      }
    }

    stepSections.push(new Paragraph({ children: [], spacing: { after: 120 } }));
  }

  // ─── Failure section ────────────────────────────────────────────────────────

  const failureSection: (Paragraph | Table)[] = [];
  const failureScreenshots = screenshots.filter((s) => s.isFailure);

  if (run.status === 'failed') {
    failureSection.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: 'Failure Details', bold: true, size: 28, color: COLORS.danger, font: 'Segoe UI' })],
        spacing: { before: 400, after: 160 },
      }),
      new Paragraph({
        children: [
          labelText('Failed at Step: '),
          normalText(String(run.failedStep ?? 'Unknown')),
        ],
        spacing: { after: 80 },
      }),
      new Paragraph({
        children: [
          labelText('Failure Reason: '),
          new TextRun({
            text: run.failureReason ?? 'Unknown failure',
            size: 20,
            color: COLORS.danger,
            font: 'Segoe UI',
          }),
        ],
        spacing: { after: 200 },
      }),
    );

    for (const failShot of failureScreenshots) {
      const imgBuffer = await loadImage(failShot.path);
      if (imgBuffer) {
        failureSection.push(
          new Paragraph({
            children: [boldText('Failure Screenshot', 20, COLORS.danger)],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new ImageRun({
                data: imgBuffer,
                transformation: { width: 600, height: 340 },
                type: 'png',
              }),
            ],
            spacing: { after: 200 },
          }),
        );
      }
    }
  }

  // ─── Build document ─────────────────────────────────────────────────────────

  const doc = new Document({
    numbering: {
      config: [],
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              // True landscape: width = long edge (11"), height = short edge (8.5")
              // 1 inch = 1440 dxa
              width: 15840,  // 11" in dxa
              height: 12240, // 8.5" in dxa
              orientation: PageOrientation.LANDSCAPE,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: company ? `${company} - Test Execution Report` : 'Test Execution Report',
                    size: 16,
                    color: COLORS.medGray,
                    font: 'Segoe UI',
                  }),
                ],
                alignment: AlignmentType.RIGHT,
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: `Generated: ${generatedAtStr}  |  Author: ${author || 'Automation Team'}`,
                    size: 16,
                    color: COLORS.medGray,
                    font: 'Segoe UI',
                  }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
          }),
        },
        children: [
          // Cover — brand name, test case title, status
          new Paragraph({
            children: [boldText('[REDACTED]', 40, COLORS.primary)],
            spacing: { before: 0, after: 60 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'TEST EXECUTION REPORT', size: 20, color: COLORS.medGray, font: 'Segoe UI', bold: true }),
            ],
            spacing: { after: 480 },
          }),

          new Paragraph({
            children: [boldText(run.testCaseName, 32, COLORS.black)],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `\u2022  ${statusText}  \u2022  ${run.passedSteps}/${run.totalSteps} steps passed  \u2022  ${durationStr}`,
                bold: true,
                size: 22,
                color: statusColor,
                font: 'Segoe UI',
              }),
            ],
            spacing: { after: 400 },
          }),

          // Summary table
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [boldText('Run Summary', 28, COLORS.black)],
            spacing: { before: 200, after: 160 },
          }),
          new Table({
            width: { size: 5000, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
              bottom: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
              left: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
              right: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
              insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
              insideVertical: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
            },
            rows: [
              new TableRow({
                children: [
                  headerCell('Run ID', 18),
                  dataCell(run.id, { percentWidth: 32 }),
                  headerCell('Status', 18),
                  dataCell(statusText, { color: statusColor, bold: true, percentWidth: 32 }),
                ],
              }),
              new TableRow({
                children: [
                  headerCell('Test Case', 18),
                  dataCell(run.testCaseName, { percentWidth: 32 }),
                  headerCell('Browser', 18),
                  dataCell(run.browser, { percentWidth: 32 }),
                ],
              }),
              new TableRow({
                children: [
                  headerCell('Started At', 18),
                  dataCell(startedAtStr, { percentWidth: 32 }),
                  headerCell('Duration', 18),
                  dataCell(durationStr, { percentWidth: 32 }),
                ],
              }),
              new TableRow({
                children: [
                  headerCell('Target URL', 18),
                  dataCell(truncateUrl(run.targetUrl), { percentWidth: 32 }),
                  headerCell('Steps', 18),
                  dataCell(`${run.passedSteps} passed / ${run.totalSteps} total`, { percentWidth: 32 }),
                ],
              }),
              new TableRow({
                children: [
                  headerCell('Prepared By', 18),
                  dataCell(author, { percentWidth: 32 }),
                  headerCell('Generated', 18),
                  dataCell(generatedAtStr, { percentWidth: 32 }),
                ],
              }),
            ],
          }),

          new Paragraph({ children: [new PageBreak()] }),

          // Steps section
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [boldText('Test Steps', 28, COLORS.black)],
            spacing: { before: 200, after: 200 },
          }),

          ...stepSections,

          // Failure section
          ...failureSection,
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const safeTestName = run.testCaseName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .substring(0, 40);
  const filename = `report-${safeTestName}-${run.id.substring(0, 8)}.docx`;

  return { buffer, filename };
}
