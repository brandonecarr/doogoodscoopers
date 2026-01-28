"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Calendar,
  RefreshCw,
  ChevronDown,
  AlertCircle,
  Eye,
  RotateCcw,
  Trash2,
  MoreVertical,
  Image as ImageIcon,
  MessageSquare,
  UserPlus,
  CalendarDays,
  Target,
  SkipForward,
  Plus,
  Repeat,
  X,
  Info,
  Search,
} from "lucide-react";
import Link from "next/link";

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  companyName: string | null;
  clientType: string;
}

interface AddOn {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  priceType: string;
  isRecurring: boolean;
  isActive: boolean;
}

interface Job {
  id: string;
  scheduledDate: string;
  status: string;
  jobType: string;
  clientId: string;
  clientName: string;
  assignedToId: string | null;
  assignedToName: string;
  serviceName: string;
  completedAt: string | null;
  estimatedMinutes: number;
  durationMinutes: number | null;
  notes: string | null;
  internalNotes: string | null;
  photos: string[] | null;
}

interface StaffMember {
  id: string;
  name: string;
}

const JOB_STATUSES = [
  { value: "SCHEDULED", label: "Pending", color: "text-gray-500" },
  { value: "EN_ROUTE", label: "Dispatched", color: "text-orange-500" },
  { value: "IN_PROGRESS", label: "In Progress", color: "text-blue-500" },
  { value: "COMPLETED", label: "Completed", color: "text-green-600" },
  { value: "SKIPPED", label: "Skipped", color: "text-yellow-600" },
  { value: "CANCELED", label: "Canceled", color: "text-gray-400" },
  { value: "MISSED", label: "Missed", color: "text-red-500" },
];

const JOB_TYPES = [
  { value: "RECURRING", label: "Recurring" },
  { value: "ONE_TIME", label: "One Time" },
  { value: "ADD_ON", label: "Add-On" },
];

export default function DispatchBoardPage() {
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filters
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedTech, setSelectedTech] = useState<string>("");

  // Dropdowns
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [actionsDropdownOpen, setActionsDropdownOpen] = useState(false);

  // Dropdown refs for click outside detection
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const typeDropdownRef = useRef<HTMLDivElement>(null);
  const actionsDropdownRef = useRef<HTMLDivElement>(null);

  // Selection
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);

  // Clients for Add Job modals
  const [clientList, setClientList] = useState<Client[]>([]);
  const [clientSearchQuery, setClientSearchQuery] = useState("");

  // Modal states
  const [showAdjustPendingModal, setShowAdjustPendingModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [showChangeDateModal, setShowChangeDateModal] = useState(false);
  const [showAddResidentialModal, setShowAddResidentialModal] = useState(false);
  const [showAddCommercialModal, setShowAddCommercialModal] = useState(false);
  const [showAddResAddOnModal, setShowAddResAddOnModal] = useState(false);
  const [showAddCommAddOnModal, setShowAddCommAddOnModal] = useState(false);

  // Add-ons for add-on service modals
  const [addOnList, setAddOnList] = useState<AddOn[]>([]);
  const [selectedAddOnId, setSelectedAddOnId] = useState("");
  const [addOnJobId, setAddOnJobId] = useState(""); // Existing job to add service to

  // Adjust Pending Jobs modal form
  const [adjustTechId, setAdjustTechId] = useState("");
  const [adjustDate, setAdjustDate] = useState("");
  const [adjustMessage, setAdjustMessage] = useState("");

  // Reassign Tech modal form
  const [reassignTechId, setReassignTechId] = useState("");

  // Change Date modal form
  const [newDate, setNewDate] = useState("");

  // Add Job modal form (shared between residential/commercial)
  const [addJobClientId, setAddJobClientId] = useState("");
  const [addJobCrossSell, setAddJobCrossSell] = useState("");
  const [addJobPrice, setAddJobPrice] = useState("");
  const [addJobTechId, setAddJobTechId] = useState("");
  const [addJobDate, setAddJobDate] = useState("");
  const [addJobEstimatedTime, setAddJobEstimatedTime] = useState("30");
  const [addJobReoptimize, setAddJobReoptimize] = useState(true);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("date", selectedDate);
      if (selectedStatuses.length > 0) {
        params.set("status", selectedStatuses.join(","));
      }
      if (selectedTech) {
        params.set("assignedTo", selectedTech);
      }

      const res = await fetch(`/api/admin/jobs?${params}`);
      const data = await res.json();

      if (res.ok) {
        // Format jobs
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const formattedJobs: Job[] = (data.jobs || []).map((job: any) => {
          const clientName = job.client
            ? `${job.client.first_name || ""} ${job.client.last_name || ""}`.trim()
            : "Unknown";
          const assignedName = job.assigned_user
            ? `${job.assigned_user.first_name || ""} ${job.assigned_user.last_name || ""}`.trim()
            : "Unassigned";

          // Get service name from subscription plan or metadata
          let serviceName = "No data";
          if (job.subscription?.plan?.name) {
            serviceName = job.subscription.plan.name;
          } else if (job.metadata?.service_name) {
            serviceName = job.metadata.service_name;
          }

          // Determine job type
          let jobType = "RECURRING";
          if (job.metadata?.job_type) {
            jobType = job.metadata.job_type;
          } else if (!job.subscription_id) {
            jobType = "ONE_TIME";
          }

          // Check if job is missed (past date, not completed)
          let status = job.status;
          const today = new Date().toISOString().split("T")[0];
          if (job.scheduled_date < today && !["COMPLETED", "SKIPPED", "CANCELED"].includes(job.status)) {
            status = "MISSED";
          }

          return {
            id: job.id,
            scheduledDate: job.scheduled_date,
            status,
            jobType,
            clientId: job.client_id,
            clientName,
            assignedToId: job.assigned_to,
            assignedToName: assignedName,
            serviceName,
            completedAt: job.completed_at,
            estimatedMinutes: job.metadata?.estimated_minutes || 30,
            durationMinutes: job.duration_minutes,
            notes: job.notes,
            internalNotes: job.internal_notes,
            photos: job.photos,
          };
        });

        // Filter by job type if selected
        const filteredJobs = selectedTypes.length > 0
          ? formattedJobs.filter((j) => selectedTypes.includes(j.jobType))
          : formattedJobs;

        setJobs(filteredJobs);
      } else {
        setError(data.error || "Failed to load jobs");
      }
    } catch (err) {
      console.error("Error fetching jobs:", err);
      setError("Failed to load jobs");
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedStatuses, selectedTech, selectedTypes]);

  const fetchStaff = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/staff");
      const data = await res.json();
      if (res.ok) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const staff = (data.users || []).map((u: any) => ({
          id: u.id,
          name: `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.email,
        }));
        setStaffList(staff);
      }
    } catch (err) {
      console.error("Error fetching staff:", err);
    }
  }, []);

  const fetchClients = useCallback(async (type: string) => {
    try {
      const res = await fetch(`/api/admin/clients?type=${type}&limit=500`);
      const data = await res.json();
      if (res.ok) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const clients = (data.clients || []).map((c: any) => ({
          id: c.id,
          firstName: c.first_name || "",
          lastName: c.last_name || "",
          companyName: c.company_name || null,
          clientType: c.client_type,
        }));
        setClientList(clients);
      }
    } catch (err) {
      console.error("Error fetching clients:", err);
    }
  }, []);

  const fetchAddOns = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/add-ons?active=true");
      const data = await res.json();
      if (res.ok) {
        setAddOnList(data.addOns || []);
      }
    } catch (err) {
      console.error("Error fetching add-ons:", err);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
    fetchStaff();
  }, [fetchJobs, fetchStaff]);

  const handleGo = () => {
    fetchJobs();
  };

  const resetFilters = () => {
    setSelectedDate(new Date().toISOString().split("T")[0]);
    setSelectedStatuses([]);
    setSelectedTypes([]);
    setSelectedTech("");
  };

  const toggleStatus = (status: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  const toggleType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const toggleJobSelection = (jobId: string) => {
    setSelectedJobs((prev) =>
      prev.includes(jobId) ? prev.filter((id) => id !== jobId) : [...prev, jobId]
    );
  };

  const toggleAllJobs = () => {
    if (selectedJobs.length === jobs.length) {
      setSelectedJobs([]);
    } else {
      setSelectedJobs(jobs.map((j) => j.id));
    }
  };

  const formatTime = (dateTimeString: string | null) => {
    if (!dateTimeString) return "--:--:--";
    return new Date(dateTimeString).toLocaleString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).replace(",", "");
  };

  const formatDuration = (minutes: number | null) => {
    if (minutes === null || minutes === undefined) return "--:--";
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
  };

  const formatEstimatedTime = (minutes: number) => {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
  };

  const getStatusDisplay = (status: string) => {
    const statusConfig = JOB_STATUSES.find((s) => s.value === status);
    return statusConfig || { label: status, color: "text-gray-500" };
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm("Are you sure you want to delete this job?")) return;

    try {
      const res = await fetch(`/api/admin/jobs?id=${jobId}`, { method: "DELETE" });
      if (res.ok) {
        setSuccess("Job deleted successfully");
        setTimeout(() => setSuccess(null), 3000);
        fetchJobs();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to delete job");
      }
    } catch (err) {
      console.error("Error deleting job:", err);
      setError("Failed to delete job");
    }
  };

  const handleRecleanJob = async (jobId: string) => {
    try {
      const res = await fetch("/api/admin/jobs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: jobId,
          status: "SCHEDULED",
          completed_at: null,
          duration_minutes: null,
          started_at: null,
        }),
      });

      if (res.ok) {
        setSuccess("Job marked for reclean");
        setTimeout(() => setSuccess(null), 3000);
        fetchJobs();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to mark job for reclean");
      }
    } catch (err) {
      console.error("Error marking reclean:", err);
      setError("Failed to mark job for reclean");
    }
  };

  const handleBulkAction = async (action: string) => {
    if (selectedJobs.length === 0 && !["add_residential", "add_commercial", "add_res_addon", "add_comm_addon"].includes(action)) {
      setError("Please select at least one job");
      return;
    }

    setActionsDropdownOpen(false);

    switch (action) {
      case "skip_pending":
      case "skip_dispatched":
        try {
          const res = await fetch("/api/admin/jobs/bulk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "skip",
              job_ids: selectedJobs,
              skip_reason: "Skipped from dispatch board",
            }),
          });
          if (res.ok) {
            const data = await res.json();
            setSuccess(`${data.affected} jobs skipped successfully`);
            setTimeout(() => setSuccess(null), 3000);
            setSelectedJobs([]);
            fetchJobs();
          }
        } catch {
          setError("Failed to skip jobs");
        }
        break;

      case "reclean":
        for (const jobId of selectedJobs) {
          await handleRecleanJob(jobId);
        }
        setSelectedJobs([]);
        break;

      case "delete":
        if (!confirm(`Are you sure you want to delete ${selectedJobs.length} jobs?`)) return;
        for (const jobId of selectedJobs) {
          await fetch(`/api/admin/jobs?id=${jobId}`, { method: "DELETE" });
        }
        setSuccess("Jobs deleted successfully");
        setTimeout(() => setSuccess(null), 3000);
        setSelectedJobs([]);
        fetchJobs();
        break;

      case "reassign":
        setReassignTechId("");
        setShowReassignModal(true);
        break;

      case "change_date":
        setNewDate(selectedDate);
        setShowChangeDateModal(true);
        break;

      case "adjust_pending":
        setAdjustTechId("");
        setAdjustDate(selectedDate);
        setAdjustMessage("");
        setShowAdjustPendingModal(true);
        break;

      case "add_residential":
        fetchClients("residential");
        setAddJobClientId("");
        setAddJobCrossSell("");
        setAddJobPrice("");
        setAddJobTechId("");
        setAddJobDate(selectedDate);
        setAddJobEstimatedTime("30");
        setAddJobReoptimize(true);
        setClientSearchQuery("");
        setShowAddResidentialModal(true);
        break;

      case "add_commercial":
        fetchClients("commercial");
        setAddJobClientId("");
        setAddJobCrossSell("");
        setAddJobPrice("");
        setAddJobTechId("");
        setAddJobDate(selectedDate);
        setAddJobEstimatedTime("30");
        setAddJobReoptimize(true);
        setClientSearchQuery("");
        setShowAddCommercialModal(true);
        break;

      case "add_res_addon":
        if (selectedJobs.length !== 1) {
          setError("Please select exactly one job to add an add-on service");
          return;
        }
        fetchClients("residential");
        fetchAddOns();
        setAddOnJobId(selectedJobs[0]);
        setSelectedAddOnId("");
        setAddJobClientId("");
        setAddJobPrice("");
        setAddJobTechId("");
        setAddJobDate(selectedDate);
        setClientSearchQuery("");
        setShowAddResAddOnModal(true);
        break;

      case "add_comm_addon":
        if (selectedJobs.length !== 1) {
          setError("Please select exactly one job to add an add-on service");
          return;
        }
        fetchClients("commercial");
        fetchAddOns();
        setAddOnJobId(selectedJobs[0]);
        setSelectedAddOnId("");
        setAddJobClientId("");
        setAddJobPrice("");
        setAddJobTechId("");
        setAddJobDate(selectedDate);
        setClientSearchQuery("");
        setShowAddCommAddOnModal(true);
        break;

      default:
        setError(`Action "${action}" not implemented yet`);
    }
  };

  // Handle Adjust Pending Jobs submit
  const handleAdjustPendingSubmit = async () => {
    if (!adjustTechId && !adjustDate) {
      setError("Please select a tech or date");
      return;
    }

    try {
      // Update jobs with new tech and/or date
      for (const jobId of selectedJobs) {
        const updates: Record<string, unknown> = { id: jobId };
        if (adjustTechId) updates.assigned_to = adjustTechId;
        if (adjustDate) updates.scheduled_date = adjustDate;
        if (adjustMessage) updates.notes = adjustMessage;

        await fetch("/api/admin/jobs", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
      }

      setSuccess(`${selectedJobs.length} jobs adjusted successfully`);
      setTimeout(() => setSuccess(null), 3000);
      setSelectedJobs([]);
      setShowAdjustPendingModal(false);
      fetchJobs();
    } catch {
      setError("Failed to adjust jobs");
    }
  };

  // Handle Reassign Tech submit
  const handleReassignSubmit = async () => {
    if (!reassignTechId) {
      setError("Please select a tech");
      return;
    }

    try {
      // Update assigned_to for each job
      for (const jobId of selectedJobs) {
        await fetch("/api/admin/jobs", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: jobId,
            assigned_to: reassignTechId,
          }),
        });
      }

      setSuccess(`${selectedJobs.length} jobs reassigned successfully`);
      setTimeout(() => setSuccess(null), 3000);
      setSelectedJobs([]);
      setShowReassignModal(false);
      fetchJobs();
    } catch {
      setError("Failed to reassign jobs");
    }
  };

  // Handle Change Date submit
  const handleChangeDateSubmit = async () => {
    if (!newDate) {
      setError("Please select a date");
      return;
    }

    try {
      const res = await fetch("/api/admin/jobs/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reschedule",
          job_ids: selectedJobs,
          new_date: newDate,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSuccess(`${data.affected} jobs rescheduled successfully`);
        setTimeout(() => setSuccess(null), 3000);
        setSelectedJobs([]);
        setShowChangeDateModal(false);
        fetchJobs();
      }
    } catch {
      setError("Failed to reschedule jobs");
    }
  };

  // Handle Add Job submit
  const handleAddJobSubmit = async (clientType: string) => {
    if (!addJobClientId) {
      setError("Please select a client");
      return;
    }
    if (!addJobDate) {
      setError("Please select a date");
      return;
    }

    try {
      // First, get the client's primary location
      const clientRes = await fetch(`/api/admin/clients/${addJobClientId}`);
      const clientData = await clientRes.json();

      if (!clientRes.ok || !clientData.client) {
        setError("Failed to load client data");
        return;
      }

      const client = clientData.client;
      const primaryLocation = client.locations?.find((l: { is_primary: boolean }) => l.is_primary) || client.locations?.[0];

      if (!primaryLocation) {
        setError("Client has no location. Please add a location first.");
        return;
      }

      // Create the job
      const jobRes = await fetch("/api/admin/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: addJobClientId,
          location_id: primaryLocation.id,
          scheduled_date: addJobDate,
          assigned_to: addJobTechId || null,
          price_cents: addJobPrice ? Math.round(parseFloat(addJobPrice) * 100) : 0,
          status: "SCHEDULED",
          metadata: {
            job_type: "ONE_TIME",
            service_name: addJobCrossSell || "Custom Job",
            estimated_minutes: parseInt(addJobEstimatedTime) || 30,
            client_type: clientType,
            reoptimize_route: addJobReoptimize,
          },
        }),
      });

      if (jobRes.ok) {
        setSuccess("Job created successfully");
        setTimeout(() => setSuccess(null), 3000);
        setShowAddResidentialModal(false);
        setShowAddCommercialModal(false);
        fetchJobs();
      } else {
        const data = await jobRes.json();
        setError(data.error || "Failed to create job");
      }
    } catch {
      setError("Failed to create job");
    }
  };

  // Handle Add-On Service submit
  const handleAddOnServiceSubmit = async (clientType: string) => {
    if (!selectedAddOnId) {
      setError("Please select an add-on service");
      return;
    }
    if (!addJobClientId) {
      setError("Please select a client");
      return;
    }
    if (!addJobDate) {
      setError("Please select a date");
      return;
    }

    try {
      // Get the selected add-on details
      const selectedAddOn = addOnList.find((a) => a.id === selectedAddOnId);
      if (!selectedAddOn) {
        setError("Selected add-on not found");
        return;
      }

      // Get the client's primary location
      const clientRes = await fetch(`/api/admin/clients/${addJobClientId}`);
      const clientData = await clientRes.json();

      if (!clientRes.ok || !clientData.client) {
        setError("Failed to load client data");
        return;
      }

      const client = clientData.client;
      const primaryLocation = client.locations?.find((l: { is_primary: boolean }) => l.is_primary) || client.locations?.[0];

      if (!primaryLocation) {
        setError("Client has no location. Please add a location first.");
        return;
      }

      // Use custom price if provided, otherwise use add-on price
      const priceCents = addJobPrice
        ? Math.round(parseFloat(addJobPrice) * 100)
        : selectedAddOn.priceCents;

      // Create the add-on service job
      const jobRes = await fetch("/api/admin/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: addJobClientId,
          location_id: primaryLocation.id,
          scheduled_date: addJobDate,
          assigned_to: addJobTechId || null,
          price_cents: priceCents,
          status: "SCHEDULED",
          metadata: {
            job_type: "ADD_ON",
            service_name: selectedAddOn.name,
            add_on_id: selectedAddOn.id,
            estimated_minutes: 15,
            client_type: clientType,
            related_job_id: addOnJobId || null,
          },
        }),
      });

      if (jobRes.ok) {
        setSuccess("Add-on service created successfully");
        setTimeout(() => setSuccess(null), 3000);
        setShowAddResAddOnModal(false);
        setShowAddCommAddOnModal(false);
        setSelectedJobs([]);
        fetchJobs();
      } else {
        const data = await jobRes.json();
        setError(data.error || "Failed to create add-on service");
      }
    } catch {
      setError("Failed to create add-on service");
    }
  };

  // Filter clients based on search query
  const filteredClients = clientList.filter((client) => {
    const searchLower = clientSearchQuery.toLowerCase();
    const fullName = `${client.firstName} ${client.lastName}`.toLowerCase();
    const companyName = (client.companyName || "").toLowerCase();
    return fullName.includes(searchLower) || companyName.includes(searchLower);
  });

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(target)) {
        setStatusDropdownOpen(false);
      }
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(target)) {
        setTypeDropdownOpen(false);
      }
      if (actionsDropdownRef.current && !actionsDropdownRef.current.contains(target)) {
        setActionsDropdownOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const statusLabel = selectedStatuses.length === 0
    ? "All Statuses"
    : selectedStatuses.length === 1
    ? JOB_STATUSES.find((s) => s.value === selectedStatuses[0])?.label
    : `${JOB_STATUSES.find((s) => s.value === selectedStatuses[0])?.label} (+${selectedStatuses.length - 1} others)`;

  const typeLabel = selectedTypes.length === 0
    ? "All Types"
    : selectedTypes.length === 1
    ? JOB_TYPES.find((t) => t.value === selectedTypes[0])?.label
    : `${JOB_TYPES.find((t) => t.value === selectedTypes[0])?.label} (+${selectedTypes.length - 1} others)`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dispatch Board</h1>
        <div className="flex items-center gap-2 border-l-4 border-teal-500 pl-3">
          <span className="text-3xl font-bold text-teal-600">{jobs.length}</span>
          <div className="text-xs text-gray-500 leading-tight">
            <div>JOBS</div>
            <div>TOTAL</div>
          </div>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-lg">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">×</button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-4 bg-green-50 text-green-700 rounded-lg">
          {success}
          <button onClick={() => setSuccess(null)} className="ml-auto text-green-500 hover:text-green-700">×</button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Date Picker */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Date</label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <Calendar className="w-4 h-4" />
              </div>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
          </div>

          {/* Status Dropdown */}
          <div ref={statusDropdownRef}>
            <label className="block text-xs text-gray-500 mb-1">Job Status</label>
            <div className="relative">
              <button
                onClick={() => {
                  setStatusDropdownOpen(!statusDropdownOpen);
                  setTypeDropdownOpen(false);
                }}
                className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 min-w-[180px] bg-white"
              >
                <span className="text-sm">{statusLabel}</span>
                <ChevronDown className="w-4 h-4 ml-auto" />
              </button>
              {statusDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[200px]">
                  {JOB_STATUSES.map((status) => (
                    <label
                      key={status.value}
                      className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedStatuses.includes(status.value)}
                        onChange={() => toggleStatus(status.value)}
                        className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                      />
                      <span className={`text-sm ${status.color}`}>{status.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Type Dropdown */}
          <div ref={typeDropdownRef}>
            <label className="block text-xs text-gray-500 mb-1">Job Type</label>
            <div className="relative">
              <button
                onClick={() => {
                  setTypeDropdownOpen(!typeDropdownOpen);
                  setStatusDropdownOpen(false);
                }}
                className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 min-w-[180px] bg-white"
              >
                <span className="text-sm">{typeLabel}</span>
                <ChevronDown className="w-4 h-4 ml-auto" />
              </button>
              {typeDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[180px]">
                  {JOB_TYPES.map((type) => (
                    <label
                      key={type.value}
                      className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedTypes.includes(type.value)}
                        onChange={() => toggleType(type.value)}
                        className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                      />
                      <span className="text-sm">{type.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Tech Dropdown */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Field Tech Name</label>
            <select
              value={selectedTech}
              onChange={(e) => setSelectedTech(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 min-w-[180px] bg-white"
            >
              <option value="">All Techs</option>
              {staffList.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.name}
                </option>
              ))}
            </select>
          </div>

          {/* GO Button */}
          <div className="pt-5">
            <button
              onClick={handleGo}
              disabled={loading}
              className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 font-medium"
            >
              GO
            </button>
          </div>

          <div className="flex-1" />

          {/* More Options */}
          <div className="pt-5">
            <button className="p-2 text-gray-400 hover:text-gray-600">
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>

          {/* Refresh */}
          <div className="pt-5">
            <button
              onClick={fetchJobs}
              disabled={loading}
              className="p-2 text-teal-600 hover:bg-teal-50 rounded-lg disabled:opacity-50 border border-teal-200"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {/* Actions Dropdown */}
          <div className="pt-5 relative" ref={actionsDropdownRef}>
            <button
              onClick={() => setActionsDropdownOpen(!actionsDropdownOpen)}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
            >
              ACTIONS
              <ChevronDown className="w-4 h-4" />
            </button>
            {actionsDropdownOpen && (
              <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[300px]">
                <button
                  onClick={() => handleBulkAction("reassign")}
                  className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 text-left"
                >
                  <UserPlus className="w-5 h-5 text-gray-500" />
                  <span>Reassign Tech</span>
                </button>
                <button
                  onClick={() => handleBulkAction("change_date")}
                  className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 text-left"
                >
                  <CalendarDays className="w-5 h-5 text-gray-500" />
                  <span>Change Date</span>
                </button>
                <button
                  onClick={() => handleBulkAction("adjust_pending")}
                  className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 text-left"
                >
                  <Target className="w-5 h-5 text-gray-500" />
                  <span>Adjust Pending Jobs</span>
                </button>
                <button
                  onClick={() => handleBulkAction("skip_dispatched")}
                  className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 text-left"
                >
                  <SkipForward className="w-5 h-5 text-orange-500" />
                  <span>Skip Dispatched</span>
                </button>
                <button
                  onClick={() => handleBulkAction("skip_pending")}
                  className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 text-left"
                >
                  <SkipForward className="w-5 h-5 text-gray-500" />
                  <span>Skip Pending</span>
                </button>
                <button
                  onClick={() => handleBulkAction("reclean")}
                  className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 text-left"
                >
                  <RotateCcw className="w-5 h-5 text-orange-500" />
                  <span>Reclean Job</span>
                </button>
                <div className="border-t border-gray-100" />
                <button
                  onClick={() => handleBulkAction("add_residential")}
                  className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 text-left"
                >
                  <Plus className="w-5 h-5 text-green-500" />
                  <span>Add Residential Job</span>
                </button>
                <button
                  onClick={() => handleBulkAction("add_commercial")}
                  className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 text-left"
                >
                  <Plus className="w-5 h-5 text-green-500" />
                  <span>Add Commercial Job</span>
                </button>
                <button
                  onClick={() => handleBulkAction("add_res_addon")}
                  className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 text-left"
                >
                  <Repeat className="w-5 h-5 text-teal-500" />
                  <span>Add Residential One-Time Add-On Service</span>
                </button>
                <button
                  onClick={() => handleBulkAction("add_comm_addon")}
                  className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 text-left"
                >
                  <Repeat className="w-5 h-5 text-teal-500" />
                  <span>Add Commercial One-Time Add-On Service</span>
                </button>
                <div className="border-t border-gray-100" />
                <button
                  onClick={() => handleBulkAction("delete")}
                  className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 text-left text-red-600"
                >
                  <Trash2 className="w-5 h-5" />
                  <span>Delete Job</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Reset Filters */}
        <div className="mt-3">
          <button
            onClick={resetFilters}
            className="text-teal-600 hover:text-teal-700 text-sm font-medium"
          >
            Reset Filters
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedJobs.length === jobs.length && jobs.length > 0}
                    onChange={toggleAllJobs}
                    className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cleanup Assign To</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Service Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Completed Time</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estimated Time</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Spent Time</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center">
                    <div className="animate-spin w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full mx-auto" />
                  </td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-gray-500">
                    No jobs found for this date
                  </td>
                </tr>
              ) : (
                jobs.map((job) => {
                  const statusDisplay = getStatusDisplay(job.status);
                  const hasNotes = job.internalNotes;
                  const hasPhotos = job.photos && job.photos.length > 0;

                  return (
                    <tr key={job.id} className="group">
                      {/* Main row */}
                      <td className="px-4 py-3 align-top">
                        <input
                          type="checkbox"
                          checked={selectedJobs.includes(job.id)}
                          onChange={() => toggleJobSelection(job.id)}
                          className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                        />
                      </td>
                      <td className="px-4 py-3 align-top">
                        {job.jobType === "RECURRING" ? (
                          <RefreshCw className="w-4 h-4 text-gray-400" />
                        ) : (
                          <Repeat className="w-4 h-4 text-blue-400" />
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span className={`text-sm font-medium ${statusDisplay.color}`}>
                          {statusDisplay.label.toUpperCase()}
                        </span>
                        {/* Notes indicator row */}
                        {hasNotes && (
                          <div className="mt-2 flex items-center gap-2 text-xs">
                            <MessageSquare className="w-3 h-3 text-yellow-500" />
                            <span className="text-teal-600">Note To Office:</span>
                            <span className="text-gray-600 truncate max-w-[200px]">{job.internalNotes}</span>
                          </div>
                        )}
                        {hasPhotos && (
                          <div className="mt-1 flex items-center gap-2 text-xs">
                            <ImageIcon className="w-3 h-3 text-blue-500" />
                            <span className="text-blue-600">Photo to Client</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center gap-2">
                          <button className="text-gray-400 hover:text-gray-600">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          <Link
                            href={`/app/office/clients/${job.clientId}`}
                            className="text-sm text-gray-900 hover:text-teal-600"
                          >
                            {job.clientName}
                          </Link>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center gap-2">
                          <button className="text-gray-400 hover:text-gray-600">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          <span className="text-sm text-gray-900">{job.assignedToName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 align-top">
                        {job.serviceName}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 align-top">
                        {formatTime(job.completedAt)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 align-top">
                        {formatEstimatedTime(job.estimatedMinutes)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 align-top">
                        {formatDuration(job.durationMinutes)}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center gap-1 text-sm">
                          <Link
                            href={`/app/office/dispatch/${job.id}`}
                            className="text-teal-600 hover:text-teal-700 flex items-center gap-1"
                          >
                            View
                            {hasPhotos && <Eye className="w-3 h-3" />}
                          </Link>
                          <button
                            onClick={() => handleRecleanJob(job.id)}
                            className="text-orange-500 hover:text-orange-600 flex items-center gap-1 ml-2"
                          >
                            Reclean
                            <RotateCcw className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDeleteJob(job.id)}
                            className="text-red-400 hover:text-red-600 flex items-center gap-1 ml-2"
                          >
                            Delete
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjust Pending Jobs Modal */}
      {showAdjustPendingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Adjust Pending Job</h2>
              <button
                onClick={() => setShowAdjustPendingModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Field Tech
                </label>
                <select
                  value={adjustTechId}
                  onChange={(e) => setAdjustTechId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  <option value="">Select Tech</option>
                  {staffList.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={adjustDate}
                  onChange={(e) => setAdjustDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Custom Off-Schedule Message to Client
                </label>
                <textarea
                  value={adjustMessage}
                  onChange={(e) => setAdjustMessage(e.target.value)}
                  placeholder="Enter message to send to client..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-gray-200">
              <button
                onClick={() => setShowAdjustPendingModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleAdjustPendingSubmit}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reassign Tech Modal */}
      {showReassignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Reassign Tech</h2>
              <button
                onClick={() => setShowReassignModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-gray-600">
                Reassigning {selectedJobs.length} job{selectedJobs.length > 1 ? "s" : ""} to a new tech.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select New Tech
                </label>
                <select
                  value={reassignTechId}
                  onChange={(e) => setReassignTechId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  <option value="">Select Tech</option>
                  {staffList.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-gray-200">
              <button
                onClick={() => setShowReassignModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleReassignSubmit}
                disabled={!reassignTechId}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
              >
                Reassign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Date Modal */}
      {showChangeDateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Change Date</h2>
              <button
                onClick={() => setShowChangeDateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-gray-600">
                Rescheduling {selectedJobs.length} job{selectedJobs.length > 1 ? "s" : ""} to a new date.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select New Date
                </label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-gray-200">
              <button
                onClick={() => setShowChangeDateModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleChangeDateSubmit}
                disabled={!newDate}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
              >
                Change Date
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Residential Job Modal */}
      {showAddResidentialModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Set Up Residential Custom Job</h2>
              <button
                onClick={() => setShowAddResidentialModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Info Banner */}
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-700">
                  Add a NEW Residential Custom Job for a client that does not currently have any Subscription.
                  Client won&apos;t be charged via Autopay. An invoice will need to be created separately.
                </p>
              </div>

              {/* Client Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Custom Job Client
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search clients..."
                    value={clientSearchQuery}
                    onChange={(e) => setClientSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
                <select
                  value={addJobClientId}
                  onChange={(e) => setAddJobClientId(e.target.value)}
                  size={5}
                  className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  <option value="">Select a client</option>
                  {filteredClients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.firstName} {client.lastName}
                      {client.companyName ? ` (${client.companyName})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Cross-Sell */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cross-Sell (Service Type)
                </label>
                <select
                  value={addJobCrossSell}
                  onChange={(e) => setAddJobCrossSell(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  <option value="">Select service type</option>
                  <option value="One-Time Cleanup">One-Time Cleanup</option>
                  <option value="Initial Cleanup">Initial Cleanup</option>
                  <option value="Deep Clean">Deep Clean</option>
                  <option value="Yard Deodorizing">Yard Deodorizing</option>
                  <option value="Sanitizing Service">Sanitizing Service</option>
                </select>
              </div>

              {/* Price Per Unit */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Price Per Unit ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={addJobPrice}
                  onChange={(e) => setAddJobPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>

              {/* Tech */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Custom Job Tech
                </label>
                <select
                  value={addJobTechId}
                  onChange={(e) => setAddJobTechId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  <option value="">Select Tech (Optional)</option>
                  {staffList.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Custom Job Date
                </label>
                <input
                  type="date"
                  value={addJobDate}
                  onChange={(e) => setAddJobDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>

              {/* Estimated Time */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estimated Time (minutes)
                </label>
                <input
                  type="number"
                  value={addJobEstimatedTime}
                  onChange={(e) => setAddJobEstimatedTime(e.target.value)}
                  placeholder="30"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>

              {/* Reoptimize Route */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="reoptimize"
                  checked={addJobReoptimize}
                  onChange={(e) => setAddJobReoptimize(e.target.checked)}
                  className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                />
                <label htmlFor="reoptimize" className="text-sm text-gray-700">
                  Reoptimize Route
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-gray-200">
              <button
                onClick={() => setShowAddResidentialModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAddJobSubmit("residential")}
                disabled={!addJobClientId || !addJobDate}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
              >
                Create Job
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Commercial Job Modal */}
      {showAddCommercialModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Set Up Commercial Custom Job</h2>
              <button
                onClick={() => setShowAddCommercialModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Info Banner */}
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-700">
                  Add a NEW Commercial Custom Job for a client that does not currently have any Subscription.
                  Client won&apos;t be charged via Autopay. An invoice will need to be created separately.
                </p>
              </div>

              {/* Client Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Custom Job Client
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search clients..."
                    value={clientSearchQuery}
                    onChange={(e) => setClientSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
                <select
                  value={addJobClientId}
                  onChange={(e) => setAddJobClientId(e.target.value)}
                  size={5}
                  className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  <option value="">Select a client</option>
                  {filteredClients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.companyName || `${client.firstName} ${client.lastName}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Cross-Sell */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cross-Sell (Service Type)
                </label>
                <select
                  value={addJobCrossSell}
                  onChange={(e) => setAddJobCrossSell(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  <option value="">Select service type</option>
                  <option value="Commercial Cleanup">Commercial Cleanup</option>
                  <option value="One-Time Cleanup">One-Time Cleanup</option>
                  <option value="Deep Clean">Deep Clean</option>
                  <option value="Sanitizing Service">Sanitizing Service</option>
                  <option value="Deodorizing Service">Deodorizing Service</option>
                </select>
              </div>

              {/* Price Per Unit */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Price Per Unit ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={addJobPrice}
                  onChange={(e) => setAddJobPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>

              {/* Tech */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Custom Job Tech
                </label>
                <select
                  value={addJobTechId}
                  onChange={(e) => setAddJobTechId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  <option value="">Select Tech (Optional)</option>
                  {staffList.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Custom Job Date
                </label>
                <input
                  type="date"
                  value={addJobDate}
                  onChange={(e) => setAddJobDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>

              {/* Estimated Time */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estimated Time (minutes)
                </label>
                <input
                  type="number"
                  value={addJobEstimatedTime}
                  onChange={(e) => setAddJobEstimatedTime(e.target.value)}
                  placeholder="30"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>

              {/* Reoptimize Route */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="reoptimize-commercial"
                  checked={addJobReoptimize}
                  onChange={(e) => setAddJobReoptimize(e.target.checked)}
                  className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                />
                <label htmlFor="reoptimize-commercial" className="text-sm text-gray-700">
                  Reoptimize Route
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-gray-200">
              <button
                onClick={() => setShowAddCommercialModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAddJobSubmit("commercial")}
                disabled={!addJobClientId || !addJobDate}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
              >
                Create Job
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Residential One-Time Add-On Service Modal */}
      {showAddResAddOnModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Add Residential One-Time Add-On Service</h2>
              <button
                onClick={() => setShowAddResAddOnModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Info Banner */}
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-700">
                  Add a one-time add-on service for a residential client.
                  This will be scheduled as a separate job linked to the selected job.
                </p>
              </div>

              {/* Add-On Service Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Add-On Service
                </label>
                <select
                  value={selectedAddOnId}
                  onChange={(e) => {
                    setSelectedAddOnId(e.target.value);
                    // Auto-fill price when add-on is selected
                    const addOn = addOnList.find((a) => a.id === e.target.value);
                    if (addOn) {
                      setAddJobPrice((addOn.priceCents / 100).toFixed(2));
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  <option value="">Select add-on service</option>
                  {addOnList.map((addOn) => (
                    <option key={addOn.id} value={addOn.id}>
                      {addOn.name} - ${(addOn.priceCents / 100).toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Client Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search clients..."
                    value={clientSearchQuery}
                    onChange={(e) => setClientSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
                <select
                  value={addJobClientId}
                  onChange={(e) => setAddJobClientId(e.target.value)}
                  size={5}
                  className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  <option value="">Select a client</option>
                  {filteredClients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.firstName} {client.lastName}
                      {client.companyName ? ` (${client.companyName})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Price Override */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Price ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={addJobPrice}
                  onChange={(e) => setAddJobPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
                <p className="text-xs text-gray-500 mt-1">Leave blank to use default add-on price</p>
              </div>

              {/* Tech */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assign To
                </label>
                <select
                  value={addJobTechId}
                  onChange={(e) => setAddJobTechId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  <option value="">Select Tech (Optional)</option>
                  {staffList.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Service Date
                </label>
                <input
                  type="date"
                  value={addJobDate}
                  onChange={(e) => setAddJobDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-gray-200">
              <button
                onClick={() => setShowAddResAddOnModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAddOnServiceSubmit("residential")}
                disabled={!selectedAddOnId || !addJobClientId || !addJobDate}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
              >
                Add Service
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Commercial One-Time Add-On Service Modal */}
      {showAddCommAddOnModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Add Commercial One-Time Add-On Service</h2>
              <button
                onClick={() => setShowAddCommAddOnModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Info Banner */}
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-700">
                  Add a one-time add-on service for a commercial client.
                  This will be scheduled as a separate job linked to the selected job.
                </p>
              </div>

              {/* Add-On Service Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Add-On Service
                </label>
                <select
                  value={selectedAddOnId}
                  onChange={(e) => {
                    setSelectedAddOnId(e.target.value);
                    // Auto-fill price when add-on is selected
                    const addOn = addOnList.find((a) => a.id === e.target.value);
                    if (addOn) {
                      setAddJobPrice((addOn.priceCents / 100).toFixed(2));
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  <option value="">Select add-on service</option>
                  {addOnList.map((addOn) => (
                    <option key={addOn.id} value={addOn.id}>
                      {addOn.name} - ${(addOn.priceCents / 100).toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Client Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search clients..."
                    value={clientSearchQuery}
                    onChange={(e) => setClientSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
                <select
                  value={addJobClientId}
                  onChange={(e) => setAddJobClientId(e.target.value)}
                  size={5}
                  className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  <option value="">Select a client</option>
                  {filteredClients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.companyName || `${client.firstName} ${client.lastName}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Price Override */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Price ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={addJobPrice}
                  onChange={(e) => setAddJobPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
                <p className="text-xs text-gray-500 mt-1">Leave blank to use default add-on price</p>
              </div>

              {/* Tech */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assign To
                </label>
                <select
                  value={addJobTechId}
                  onChange={(e) => setAddJobTechId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  <option value="">Select Tech (Optional)</option>
                  {staffList.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Service Date
                </label>
                <input
                  type="date"
                  value={addJobDate}
                  onChange={(e) => setAddJobDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-gray-200">
              <button
                onClick={() => setShowAddCommAddOnModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAddOnServiceSubmit("commercial")}
                disabled={!selectedAddOnId || !addJobClientId || !addJobDate}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
              >
                Add Service
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
