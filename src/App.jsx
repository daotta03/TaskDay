import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { CalendarDays, CheckCircle2, ClipboardList, Clock3, Download, Pencil, Plus, Search, Trash2 } from "lucide-react";

const STORAGE_KEY = "daily-task-journal-v1";

const STATUS_OPTIONS = [
  { value: "todo", label: "Chưa làm" },
  { value: "doing", label: "Đang làm" },
  { value: "done", label: "Hoàn thành" },
  { value: "blocked", label: "Bị chặn" },
];

const emptyTask = {
  title: "",
  startTime: "08:00",
  endTime: "09:00",
  status: "todo",
  note: "",
};

function todayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfWeek(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const dayOfMonth = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${dayOfMonth}`;
}

function endOfWeek(dateString) {
  const start = new Date(`${startOfWeek(dateString)}T00:00:00`);
  start.setDate(start.getDate() + 6);
  const year = start.getFullYear();
  const month = String(start.getMonth() + 1).padStart(2, "0");
  const dayOfMonth = String(start.getDate()).padStart(2, "0");
  return `${year}-${month}-${dayOfMonth}`;
}

function getDatesInWeek(dateString) {
  const start = new Date(`${startOfWeek(dateString)}T00:00:00`);
  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(start);
    current.setDate(start.getDate() + index);
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, "0");
    const dayOfMonth = String(current.getDate()).padStart(2, "0");
    return `${year}-${month}-${dayOfMonth}`;
  });
}

function parseTimeToMinutes(value) {
  if (!value || !value.includes(":")) return 0;
  const [h, m] = value.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

function formatMinutes(totalMinutes) {
  const safe = Math.max(0, totalMinutes);
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  if (hours === 0) return `${minutes} phút`;
  if (minutes === 0) return `${hours} giờ`;
  return `${hours} giờ ${minutes} phút`;
}

function durationInMinutes(task) {
  const start = parseTimeToMinutes(task.startTime);
  const end = parseTimeToMinutes(task.endTime);
  return Math.max(0, end - start);
}

function sortTasks(tasks) {
  return [...tasks].sort(
    (a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime)
  );
}

function getStatusBadge(status) {
  switch (status) {
    case "done":
      return "bg-green-100 text-green-700 border-green-200";
    case "doing":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "blocked":
      return "bg-red-100 text-red-700 border-red-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

function getStatusLabel(status) {
  return STATUS_OPTIONS.find((item) => item.value === status)?.label || "Không rõ";
}

export default function App() {
  const [selectedDate, setSelectedDate] = useState(todayString());
  const [taskMap, setTaskMap] = useState({});
  const [form, setForm] = useState(emptyTask);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        setTaskMap(parsed);
      }
    } catch (error) {
      console.error("Không thể đọc dữ liệu đã lưu", error);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(taskMap));
  }, [taskMap]);

  const tasksOfDay = useMemo(() => {
    const tasks = taskMap[selectedDate] || [];
    const normalized = sortTasks(tasks);
    if (!search.trim()) return normalized;

    const keyword = search.toLowerCase().trim();
    return normalized.filter((task) => {
      return [task.title, task.note, getStatusLabel(task.status)]
        .join(" ")
        .toLowerCase()
        .includes(keyword);
    });
  }, [taskMap, selectedDate, search]);

  const rawTasksOfDay = useMemo(
    () => sortTasks(taskMap[selectedDate] || []),
    [taskMap, selectedDate]
  );

  const dailySummary = useMemo(() => {
    const total = rawTasksOfDay.length;
    const done = rawTasksOfDay.filter((task) => task.status === "done").length;
    const doing = rawTasksOfDay.filter((task) => task.status === "doing").length;
    const blocked = rawTasksOfDay.filter((task) => task.status === "blocked").length;
    const totalMinutes = rawTasksOfDay.reduce((sum, task) => sum + durationInMinutes(task), 0);

    return { total, done, doing, blocked, totalMinutes };
  }, [rawTasksOfDay]);

  const recentDates = useMemo(() => {
    return Object.keys(taskMap)
      .sort((a, b) => b.localeCompare(a))
      .slice(0, 10)
      .map((date) => {
        const items = taskMap[date] || [];
        const done = items.filter((task) => task.status === "done").length;
        return {
          date,
          total: items.length,
          done,
          totalMinutes: items.reduce((sum, task) => sum + durationInMinutes(task), 0),
        };
      });
  }, [taskMap]);

  const completedPercent = dailySummary.total
    ? Math.round((dailySummary.done / dailySummary.total) * 100)
    : 0;

  const weeklySummary = useMemo(() => {
    const dates = getDatesInWeek(selectedDate);
    const weeklyTasks = dates.flatMap((date) =>
      (taskMap[date] || []).map((task) => ({ ...task, workDate: date }))
    );

    const total = weeklyTasks.length;
    const done = weeklyTasks.filter((task) => task.status === "done").length;
    const doing = weeklyTasks.filter((task) => task.status === "doing").length;
    const blocked = weeklyTasks.filter((task) => task.status === "blocked").length;
    const totalMinutes = weeklyTasks.reduce((sum, task) => sum + durationInMinutes(task), 0);

    return {
      startDate: startOfWeek(selectedDate),
      endDate: endOfWeek(selectedDate),
      dates,
      tasks: weeklyTasks,
      total,
      done,
      doing,
      blocked,
      totalMinutes,
    };
  }, [selectedDate, taskMap]);

  function resetForm() {
    setForm(emptyTask);
    setEditingId(null);
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (!form.title.trim()) return;

    const start = parseTimeToMinutes(form.startTime);
    const end = parseTimeToMinutes(form.endTime);
    if (end <= start) {
      alert("Giờ kết thúc phải lớn hơn giờ bắt đầu.");
      return;
    }

    setTaskMap((prev) => {
      const current = prev[selectedDate] || [];
      const payload = {
        id: editingId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: form.title.trim(),
        startTime: form.startTime,
        endTime: form.endTime,
        status: form.status,
        note: form.note.trim(),
        createdAt: editingId
          ? current.find((task) => task.id === editingId)?.createdAt || new Date().toISOString()
          : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const nextTasks = editingId
        ? current.map((task) => (task.id === editingId ? payload : task))
        : [...current, payload];

      return {
        ...prev,
        [selectedDate]: sortTasks(nextTasks),
      };
    });

    resetForm();
  }

  function handleEdit(task) {
    setEditingId(task.id);
    setForm({
      title: task.title,
      startTime: task.startTime,
      endTime: task.endTime,
      status: task.status,
      note: task.note || "",
    });
  }

  function handleDelete(taskId) {
    setTaskMap((prev) => {
      const current = prev[selectedDate] || [];
      const nextTasks = current.filter((task) => task.id !== taskId);
      const nextMap = { ...prev, [selectedDate]: nextTasks };
      if (nextTasks.length === 0) {
        delete nextMap[selectedDate];
      }
      return nextMap;
    });

    if (editingId === taskId) {
      resetForm();
    }
  }

  function handleQuickFillToday() {
    setSelectedDate(todayString());
  }

  function exportDailyText() {
    const tasks = rawTasksOfDay;
    const lines = [
      `NHẬT KÝ CÔNG VIỆC - ${selectedDate}`,
      `Tổng task: ${dailySummary.total}`,
      `Hoàn thành: ${dailySummary.done}`,
      `Tổng thời lượng: ${formatMinutes(dailySummary.totalMinutes)}`,
      "",
    ];

    tasks.forEach((task, index) => {
      lines.push(
        `${index + 1}. ${task.title}`,
        `   Thời gian: ${task.startTime} - ${task.endTime} (${formatMinutes(durationInMinutes(task))})`,
        `   Trạng thái: ${getStatusLabel(task.status)}`,
        `   Ghi chú: ${task.note || "-"}`,
        ""
      );
    });

    navigator.clipboard.writeText(lines.join("\n"));
    alert("Đã sao chép nhật ký ngày vào clipboard.");
  }

  function exportWeeklyExcel() {
    if (weeklySummary.tasks.length === 0) {
      alert("Tuần này chưa có dữ liệu để xuất Excel.");
      return;
    }

    const summaryRows = [
      ["BÁO CÁO CÔNG VIỆC THEO TUẦN", ""],
      ["Từ ngày", weeklySummary.startDate],
      ["Đến ngày", weeklySummary.endDate],
      ["Tổng task", weeklySummary.total],
      ["Hoàn thành", weeklySummary.done],
      ["Đang làm", weeklySummary.doing],
      ["Bị chặn", weeklySummary.blocked],
      ["Tổng thời lượng (phút)", weeklySummary.totalMinutes],
      ["Tổng thời lượng", formatMinutes(weeklySummary.totalMinutes)],
    ];

    const detailRows = weeklySummary.tasks
      .slice()
      .sort((a, b) => {
        if (a.workDate !== b.workDate) return a.workDate.localeCompare(b.workDate);
        return parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime);
      })
      .map((task, index) => ({
        STT: index + 1,
        Ngay: task.workDate,
        Ten_cong_viec: task.title,
        Gio_bat_dau: task.startTime,
        Gio_ket_thuc: task.endTime,
        Thoi_luong_phut: durationInMinutes(task),
        Trang_thai: getStatusLabel(task.status),
        Ghi_chu: task.note || "",
      }));

    const dailyRows = weeklySummary.dates.map((date, index) => {
      const tasks = sortTasks(taskMap[date] || []);
      const total = tasks.length;
      const done = tasks.filter((task) => task.status === "done").length;
      const doing = tasks.filter((task) => task.status === "doing").length;
      const blocked = tasks.filter((task) => task.status === "blocked").length;
      const totalMinutes = tasks.reduce((sum, task) => sum + durationInMinutes(task), 0);

      return {
        STT: index + 1,
        Ngay: date,
        Tong_task: total,
        Hoan_thanh: done,
        Dang_lam: doing,
        Bi_chan: blocked,
        Tong_thoi_luong_phut: totalMinutes,
        Tong_thoi_luong: formatMinutes(totalMinutes),
      };
    });

    const workbook = XLSX.utils.book_new();

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
    summarySheet["!cols"] = [
      { wch: 24 },
      { wch: 22 },
    ];

    const detailSheet = XLSX.utils.json_to_sheet(detailRows);
    detailSheet["!cols"] = [
      { wch: 8 },
      { wch: 14 },
      { wch: 36 },
      { wch: 12 },
      { wch: 12 },
      { wch: 18 },
      { wch: 16 },
      { wch: 40 },
    ];

    const dailySheet = XLSX.utils.json_to_sheet(dailyRows);
    dailySheet["!cols"] = [
      { wch: 8 },
      { wch: 14 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 22 },
      { wch: 22 },
    ];

    XLSX.utils.book_append_sheet(workbook, summarySheet, "Tong_quan_tuan");
    XLSX.utils.book_append_sheet(workbook, dailySheet, "Tong_hop_theo_ngay");
    XLSX.utils.book_append_sheet(workbook, detailSheet, "Chi_tiet_task");

    XLSX.writeFile(
      workbook,
      `bao-cao-tuan-${weeklySummary.startDate}-den-${weeklySummary.endDate}.xlsx`
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
              <ClipboardList className="h-4 w-4" />
              Nhật ký task công việc hằng ngày
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Theo dõi công việc theo từng ngày</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Ghi lại task, thời gian bắt đầu - kết thúc, trạng thái và ghi chú. Dữ liệu được lưu trực tiếp trên trình duyệt.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard icon={<ClipboardList className="h-4 w-4" />} label="Số task" value={String(dailySummary.total)} />
            <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label="Hoàn thành" value={`${dailySummary.done}`} />
            <StatCard icon={<Clock3 className="h-4 w-4" />} label="Thời lượng" value={formatMinutes(dailySummary.totalMinutes)} />
            <StatCard icon={<CalendarDays className="h-4 w-4" />} label="Tiến độ" value={`${completedPercent}%`} />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-6">
            <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <label className="mb-2 block text-sm font-semibold text-slate-700">Chọn ngày làm việc</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-400"
              />
              <div className="mt-3 grid grid-cols-1 gap-2">
                <button
                  onClick={handleQuickFillToday}
                  className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
                >
                  Hôm nay
                </button>
                <button
                  onClick={exportDailyText}
                  className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Sao chép báo cáo ngày
                </button>
                <button
                  onClick={exportWeeklyExcel}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100"
                >
                  <Download className="h-4 w-4" />
                  Xuất Excel theo tuần
                </button>
              </div>

              <div className="mt-4 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phạm vi tuần</div>
                <div className="mt-1 text-sm font-semibold text-slate-800">
                  {weeklySummary.startDate} đến {weeklySummary.endDate}
                </div>
                <div className="mt-2 text-xs text-slate-600">
                  {weeklySummary.total} task • {weeklySummary.done} hoàn thành • {formatMinutes(weeklySummary.totalMinutes)}
                </div>
              </div>
            </div>

            <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold">Ngày gần đây</h2>
                <span className="text-xs text-slate-500">Tối đa 10 ngày</span>
              </div>

              {recentDates.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                  Chưa có dữ liệu. Hãy thêm task đầu tiên cho ngày làm việc của bạn.
                </div>
              ) : (
                <div className="space-y-3">
                  {recentDates.map((item) => {
                    const active = item.date === selectedDate;
                    return (
                      <button
                        key={item.date}
                        onClick={() => setSelectedDate(item.date)}
                        className={`w-full rounded-2xl border p-4 text-left transition ${
                          active
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-semibold">{item.date}</div>
                          <div className={`text-xs ${active ? "text-slate-200" : "text-slate-500"}`}>
                            {item.done}/{item.total} hoàn thành
                          </div>
                        </div>
                        <div className={`mt-2 text-sm ${active ? "text-slate-200" : "text-slate-600"}`}>
                          {formatMinutes(item.totalMinutes)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>

          <main className="space-y-6">
            <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">{editingId ? "Cập nhật task" : "Thêm task mới"}</h2>
                  <p className="mt-1 text-sm text-slate-500">Ngày đang nhập: {selectedDate}</p>
                </div>
                {editingId && (
                  <button
                    onClick={resetForm}
                    className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Hủy sửa
                  </button>
                )}
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Tên công việc</label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="Ví dụ: Họp dự án, viết báo cáo, kiểm tra bug..."
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-400"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Giờ bắt đầu</label>
                    <input
                      type="time"
                      value={form.startTime}
                      onChange={(e) => setForm((prev) => ({ ...prev, startTime: e.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-400"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Giờ kết thúc</label>
                    <input
                      type="time"
                      value={form.endTime}
                      onChange={(e) => setForm((prev) => ({ ...prev, endTime: e.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-400"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Trạng thái</label>
                    <select
                      value={form.status}
                      onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-400"
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Ghi chú</label>
                  <textarea
                    rows={4}
                    value={form.note}
                    onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
                    placeholder="Kết quả công việc, vướng mắc, đầu việc cần theo dõi tiếp..."
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-400"
                  />
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:opacity-90"
                  >
                    <Plus className="h-4 w-4" />
                    {editingId ? "Lưu cập nhật" : "Thêm task"}
                  </button>

                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Làm mới form
                  </button>
                </div>
              </form>
            </div>

            <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Danh sách task trong ngày</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Tổng {dailySummary.total} task • Hoàn thành {dailySummary.done} • Đang làm {dailySummary.doing} • Bị chặn {dailySummary.blocked}
                  </p>
                </div>

                <div className="relative w-full md:w-72">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Tìm task hoặc ghi chú..."
                    className="w-full rounded-2xl border border-slate-200 py-3 pl-10 pr-4 outline-none transition focus:border-slate-400"
                  />
                </div>
              </div>

              {tasksOfDay.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-200 px-6 py-12 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                    <ClipboardList className="h-6 w-6 text-slate-500" />
                  </div>
                  <h3 className="text-lg font-semibold">Chưa có task nào</h3>
                  <p className="mt-2 text-sm text-slate-500">
                    Hãy thêm công việc cho ngày {selectedDate} để bắt đầu theo dõi tiến độ.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {tasksOfDay.map((task) => (
                    <div key={task.id} className="rounded-3xl border border-slate-200 p-5 transition hover:shadow-sm">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="mb-3 flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                              {task.startTime} - {task.endTime}
                            </span>
                            <span className={`rounded-full border px-3 py-1 text-xs font-medium ${getStatusBadge(task.status)}`}>
                              {getStatusLabel(task.status)}
                            </span>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                              {formatMinutes(durationInMinutes(task))}
                            </span>
                          </div>

                          <h3 className="text-lg font-semibold break-words">{task.title}</h3>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                            {task.note || "Không có ghi chú."}
                          </p>
                        </div>

                        <div className="flex shrink-0 gap-2">
                          <button
                            onClick={() => handleEdit(task)}
                            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                          >
                            <Pencil className="h-4 w-4" />
                            Sửa
                          </button>
                          <button
                            onClick={() => handleDelete(task.id)}
                            className="inline-flex items-center gap-2 rounded-2xl border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                            Xóa
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
      <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-700 ring-1 ring-slate-200">
        {icon}
      </div>
      <div className="text-lg font-bold leading-none">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{label}</div>
    </div>
  );
}