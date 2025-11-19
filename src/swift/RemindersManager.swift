import Foundation
import EventKit

class RemindersManager {
    private let store = EKEventStore()
    private var hasAccess = false

    // MARK: - Permission Handling

    func requestAccess() async throws {
        if #available(macOS 14.0, *) {
            hasAccess = try await store.requestFullAccessToReminders()
        } else {
            hasAccess = try await store.requestAccess(to: .reminder)
        }

        guard hasAccess else {
            throw RemindersError.permissionDenied
        }
    }

    // MARK: - List Operations

    func listReminderLists() throws -> [ReminderListModel] {
        guard hasAccess else {
            throw RemindersError.permissionDenied
        }

        let calendars = store.calendars(for: .reminder)
        return calendars.map { ReminderListModel(from: $0, store: store) }
    }

    func createReminderList(name: String, color: String?) throws -> ReminderListModel {
        guard hasAccess else {
            throw RemindersError.permissionDenied
        }

        let calendar = EKCalendar(for: .reminder, eventStore: store)
        calendar.title = name

        // Set source (iCloud or local)
        if let source = store.defaultCalendarForNewReminders()?.source {
            calendar.source = source
        } else if let source = store.sources.first(where: { $0.sourceType == .calDAV || $0.sourceType == .local }) {
            calendar.source = source
        } else {
            throw RemindersError.noValidSource
        }

        // Set color if provided
        if let colorHex = color, let cgColor = hexToColor(colorHex) {
            calendar.cgColor = cgColor
        }

        try store.saveCalendar(calendar, commit: true)

        return ReminderListModel(from: calendar, store: store)
    }

    // MARK: - Reminder Operations

    func listReminders(params: [String: Any]) throws -> [ReminderModel] {
        guard hasAccess else {
            throw RemindersError.permissionDenied
        }

        var calendars = store.calendars(for: .reminder)

        // Filter by list if specified
        if let listId = params["listId"] as? String {
            calendars = calendars.filter { $0.calendarIdentifier == listId }
        } else if let listName = params["listName"] as? String {
            calendars = calendars.filter { $0.title == listName }
        }

        let predicate = store.predicateForReminders(in: calendars)
        var allReminders: [EKReminder] = []
        let semaphore = DispatchSemaphore(value: 0)

        store.fetchReminders(matching: predicate) { reminders in
            allReminders = reminders ?? []
            semaphore.signal()
        }

        _ = semaphore.wait(timeout: .now() + 5.0)

        // Apply filters
        let showCompleted = params["showCompleted"] as? Bool ?? false
        var filtered = allReminders.filter { showCompleted || !$0.isCompleted }

        // Filter by due date
        if let dueWithin = params["dueWithin"] as? String {
            filtered = filterByDueDate(reminders: filtered, dueWithin: dueWithin)
        }

        // Search filter
        if let search = params["search"] as? String, !search.isEmpty {
            filtered = filtered.filter { reminder in
                let titleMatch = reminder.title?.lowercased().contains(search.lowercased()) ?? false
                let notesMatch = reminder.notes?.lowercased().contains(search.lowercased()) ?? false
                return titleMatch || notesMatch
            }
        }

        return filtered.map { ReminderModel(from: $0, store: store) }
    }

    func createReminder(params: [String: Any]) throws -> ReminderModel {
        guard hasAccess else {
            throw RemindersError.permissionDenied
        }

        guard let title = params["title"] as? String else {
            throw RemindersError.missingParameter("title")
        }

        let reminder = EKReminder(eventStore: store)
        reminder.title = title

        // Set calendar/list
        if let listId = params["listId"] as? String {
            let calendars = store.calendars(for: .reminder)
            guard let calendar = calendars.first(where: { $0.calendarIdentifier == listId }) else {
                throw RemindersError.listNotFound
            }
            reminder.calendar = calendar
        } else if let listName = params["listName"] as? String {
            let calendars = store.calendars(for: .reminder)
            guard let calendar = calendars.first(where: { $0.title == listName }) else {
                throw RemindersError.listNotFound
            }
            reminder.calendar = calendar
        } else {
            reminder.calendar = store.defaultCalendarForNewReminders()
        }

        // Set optional fields
        if let notes = params["notes"] as? String {
            reminder.notes = notes
        }

        if let dueDateString = params["dueDate"] as? String,
           let dueDate = ISO8601DateFormatter().date(from: dueDateString) {
            let includesTime = params["dueDateIncludesTime"] as? Bool ?? false
            reminder.dueDateComponents = dateToComponents(dueDate, includesTime: includesTime)
        }

        if let priority = params["priority"] as? Int {
            reminder.priority = priority
        }

        if let urlString = params["url"] as? String, !urlString.isEmpty,
           let url = URL(string: urlString) {
            reminder.url = url
        }

        try store.save(reminder, commit: true)

        return ReminderModel(from: reminder, store: store)
    }

    func updateReminder(params: [String: Any]) throws -> ReminderModel {
        guard hasAccess else {
            throw RemindersError.permissionDenied
        }

        guard let reminderId = params["id"] as? String else {
            throw RemindersError.missingParameter("id")
        }

        guard let reminder = store.calendarItem(withIdentifier: reminderId) as? EKReminder else {
            throw RemindersError.reminderNotFound
        }

        // Update fields
        if let title = params["title"] as? String {
            reminder.title = title
        }

        if params.keys.contains("notes") {
            reminder.notes = params["notes"] as? String
        }

        if params.keys.contains("dueDate") {
            if let dueDateString = params["dueDate"] as? String,
               let dueDate = ISO8601DateFormatter().date(from: dueDateString) {
                let includesTime = params["dueDateIncludesTime"] as? Bool ?? false
                reminder.dueDateComponents = dateToComponents(dueDate, includesTime: includesTime)
            } else {
                reminder.dueDateComponents = nil
            }
        }

        if let priority = params["priority"] as? Int {
            reminder.priority = priority
        }

        if params.keys.contains("url") {
            if let urlString = params["url"] as? String, !urlString.isEmpty,
               let url = URL(string: urlString) {
                reminder.url = url
            } else {
                reminder.url = nil
            }
        }

        if let moveToListId = params["moveToListId"] as? String {
            let calendars = store.calendars(for: .reminder)
            guard let calendar = calendars.first(where: { $0.calendarIdentifier == moveToListId }) else {
                throw RemindersError.listNotFound
            }
            reminder.calendar = calendar
        }

        try store.save(reminder, commit: true)

        return ReminderModel(from: reminder, store: store)
    }

    func completeReminder(params: [String: Any]) throws -> ReminderModel {
        guard hasAccess else {
            throw RemindersError.permissionDenied
        }

        guard let reminderId = params["id"] as? String else {
            throw RemindersError.missingParameter("id")
        }

        guard let completed = params["completed"] as? Bool else {
            throw RemindersError.missingParameter("completed")
        }

        guard let reminder = store.calendarItem(withIdentifier: reminderId) as? EKReminder else {
            throw RemindersError.reminderNotFound
        }

        reminder.isCompleted = completed
        if completed {
            reminder.completionDate = Date()
        } else {
            reminder.completionDate = nil
        }

        try store.save(reminder, commit: true)

        return ReminderModel(from: reminder, store: store)
    }

    func deleteReminder(params: [String: Any]) throws -> Bool {
        guard hasAccess else {
            throw RemindersError.permissionDenied
        }

        guard let reminderId = params["id"] as? String else {
            throw RemindersError.missingParameter("id")
        }

        guard let reminder = store.calendarItem(withIdentifier: reminderId) as? EKReminder else {
            throw RemindersError.reminderNotFound
        }

        try store.remove(reminder, commit: true)

        return true
    }

    // MARK: - Helper Methods

    private func filterByDueDate(reminders: [EKReminder], dueWithin: String) -> [EKReminder] {
        let calendar = Calendar.current
        let now = Date()

        return reminders.filter { reminder in
            guard let dueDate = reminder.dueDateComponents?.date else {
                return dueWithin == "no-date"
            }

            switch dueWithin {
            case "today":
                return calendar.isDateInToday(dueDate)
            case "tomorrow":
                return calendar.isDateInTomorrow(dueDate)
            case "this-week":
                let weekFromNow = calendar.date(byAdding: .day, value: 7, to: now)!
                return dueDate >= now && dueDate <= weekFromNow
            case "overdue":
                return dueDate < now && !reminder.isCompleted
            case "no-date":
                return false
            default:
                return true
            }
        }
    }

    private func dateToComponents(_ date: Date, includesTime: Bool) -> DateComponents {
        let calendar = Calendar.current
        if includesTime {
            return calendar.dateComponents([.year, .month, .day, .hour, .minute], from: date)
        } else {
            return calendar.dateComponents([.year, .month, .day], from: date)
        }
    }

    private func hexToColor(_ hex: String) -> CGColor? {
        var hexSanitized = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        hexSanitized = hexSanitized.replacingOccurrences(of: "#", with: "")

        var rgb: UInt64 = 0
        guard Scanner(string: hexSanitized).scanHexInt64(&rgb) else {
            return nil
        }

        let r = CGFloat((rgb & 0xFF0000) >> 16) / 255.0
        let g = CGFloat((rgb & 0x00FF00) >> 8) / 255.0
        let b = CGFloat(rgb & 0x0000FF) / 255.0

        return CGColor(red: r, green: g, blue: b, alpha: 1.0)
    }
}

// MARK: - Error Types

enum RemindersError: LocalizedError {
    case permissionDenied
    case missingParameter(String)
    case listNotFound
    case reminderNotFound
    case noValidSource
    case unknownAction(String)

    var errorDescription: String? {
        switch self {
        case .permissionDenied:
            return "Reminders permission denied. Please grant access in System Settings > Privacy & Security > Reminders."
        case .missingParameter(let param):
            return "Missing required parameter: \(param)"
        case .listNotFound:
            return "Reminder list not found"
        case .reminderNotFound:
            return "Reminder not found"
        case .noValidSource:
            return "No valid source for creating reminders"
        case .unknownAction(let action):
            return "Unknown action: \(action)"
        }
    }

    var code: String {
        switch self {
        case .permissionDenied:
            return "PERMISSION_DENIED"
        case .missingParameter:
            return "MISSING_PARAMETER"
        case .listNotFound:
            return "LIST_NOT_FOUND"
        case .reminderNotFound:
            return "REMINDER_NOT_FOUND"
        case .noValidSource:
            return "NO_VALID_SOURCE"
        case .unknownAction:
            return "UNKNOWN_ACTION"
        }
    }
}
