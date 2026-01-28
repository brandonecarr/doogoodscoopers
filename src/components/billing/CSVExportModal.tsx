"use client";

import { useState } from "react";
import { X, Download, Info, Calendar } from "lucide-react";
import type { RecurringInvoice } from "@/lib/billing/types";

interface CSVExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoices: RecurringInvoice[];
  onExport: (startDate: string, endDate: string, applyToView: boolean) => void;
  onApplyDates?: (startDate: string, endDate: string) => void;
}

export function CSVExportModal({
  isOpen,
  onClose,
  onExport,
}: CSVExportModalProps) {
  const today = new Date().toISOString().split("T")[0];
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .split("T")[0];

  const [fromDate, setFromDate] = useState(firstOfMonth);
  const [toDate, setToDate] = useState(today);
  const [applyToView, setApplyToView] = useState(false);

  if (!isOpen) return null;

  const handleExport = () => {
    onExport(fromDate, toDate, applyToView);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Export CSV</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Info Banner */}
          <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
            <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-700">
              For CSV export you need to set Start Date and End Date filters.
            </p>
          </div>

          {/* Date Inputs */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                From Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                To Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
            </div>
          </div>

          {/* Apply to View Checkbox */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={applyToView}
              onChange={(e) => setApplyToView(e.target.checked)}
              className="rounded border-gray-300 text-teal-500 focus:ring-teal-500"
            />
            <span className="text-sm text-gray-700">
              Set the same dates within the web view
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
          >
            CANCEL
          </button>
          <button
            onClick={handleExport}
            disabled={!fromDate || !toDate}
            className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            <Download className="w-4 h-4" />
            EXPORT
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Generate CSV content from recurring invoices
 */
export function generateInvoicesCSV(
  invoices: RecurringInvoice[],
  startDate: string,
  endDate: string
): string {
  const headers = [
    "Client Name",
    "Client Address",
    "Invoice Number",
    "Status",
    "Description",
    "Quantity",
    "Rate",
    "Amount",
    "Tax",
    "Tax Percent",
    "Total",
    "Tip",
  ];

  // Helper to escape CSV values
  const escapeCSV = (value: string | number | null | undefined): string => {
    const str = String(value ?? "");
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return `"${str}"`;
  };

  // Filter invoices by date range
  const filteredInvoices = invoices.filter((inv) => {
    const createdDate = inv.createdAt.split("T")[0];
    return createdDate >= startDate && createdDate <= endDate;
  });

  // Generate rows - one row per invoice item
  const rows: string[][] = [];
  filteredInvoices.forEach((inv) => {
    const statusDisplay =
      inv.status.charAt(0) + inv.status.slice(1).toLowerCase();

    if (inv.items.length === 0) {
      // Invoice with no items - still include it
      rows.push([
        escapeCSV(inv.client.name),
        escapeCSV(inv.client.address),
        escapeCSV(inv.invoiceNumber),
        escapeCSV(statusDisplay),
        escapeCSV(""),
        escapeCSV("1.00"),
        escapeCSV((inv.totalCents / 100).toFixed(2)),
        escapeCSV((inv.totalCents / 100).toFixed(2)),
        escapeCSV("0.000"),
        escapeCSV("0.000"),
        escapeCSV((inv.totalCents / 100).toFixed(2)),
        escapeCSV((inv.tipCents / 100).toFixed(2)),
      ]);
    } else {
      // One row per item
      inv.items.forEach((item) => {
        rows.push([
          escapeCSV(inv.client.name),
          escapeCSV(inv.client.address),
          escapeCSV(inv.invoiceNumber),
          escapeCSV(statusDisplay),
          escapeCSV(item.description),
          escapeCSV(item.quantity.toFixed(2)),
          escapeCSV((item.unitPriceCents / 100).toFixed(2)),
          escapeCSV((item.totalCents / 100).toFixed(2)),
          escapeCSV("0.000"),
          escapeCSV("0.000"),
          escapeCSV((item.totalCents / 100).toFixed(2)),
          escapeCSV((inv.tipCents / 100).toFixed(2)),
        ]);
      });
    }
  });

  // Build CSV content
  const csvContent = [headers.map(h => escapeCSV(h)).join(","), ...rows.map((row) => row.join(","))].join("\n");

  return csvContent;
}

/**
 * Download CSV file
 */
export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
