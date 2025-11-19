import Foundation
import EventKit

// MARK: - Data Models

struct ReminderListModel: Codable {
    let id: String
    let name: String
    let color: String?
    let count: Int
}

struct ReminderModel: Codable {
    let id: String
    let title: String
    let notes: String?
    let listId: String
    let listName: String
    let completed: Bool
    let dueDate: String?
    let dueDateIncludesTime: Bool?
    let priority: Int
    let url: String?
    let creationDate: String
    let modificationDate: String
}

// MARK: - Command/Response Models

struct Command: Codable {
    let action: String
    let params: [String: AnyCodable]?
}

struct Response<T: Codable>: Codable {
    let success: Bool
    let data: T?
    let error: ErrorInfo?
}

struct ErrorInfo: Codable {
    let code: String
    let message: String
}

// MARK: - AnyCodable for handling arbitrary JSON

struct AnyCodable: Codable {
    let value: Any

    init(_ value: Any) {
        self.value = value
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()

        if container.decodeNil() {
            self.value = NSNull()
        } else if let bool = try? container.decode(Bool.self) {
            self.value = bool
        } else if let int = try? container.decode(Int.self) {
            self.value = int
        } else if let double = try? container.decode(Double.self) {
            self.value = double
        } else if let string = try? container.decode(String.self) {
            self.value = string
        } else if let array = try? container.decode([AnyCodable].self) {
            self.value = array.map { $0.value }
        } else if let dictionary = try? container.decode([String: AnyCodable].self) {
            self.value = dictionary.mapValues { $0.value }
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unsupported type")
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()

        if value is NSNull {
            try container.encodeNil()
        } else if let bool = value as? Bool {
            try container.encode(bool)
        } else if let int = value as? Int {
            try container.encode(int)
        } else if let double = value as? Double {
            try container.encode(double)
        } else if let string = value as? String {
            try container.encode(string)
        } else if let array = value as? [Any] {
            try container.encode(array.map { AnyCodable($0) })
        } else if let dictionary = value as? [String: Any] {
            try container.encode(dictionary.mapValues { AnyCodable($0) })
        } else {
            throw EncodingError.invalidValue(value, EncodingError.Context(codingPath: container.codingPath, debugDescription: "Unsupported type"))
        }
    }
}

// MARK: - Helper Extensions

extension ReminderListModel {
    init(from calendar: EKCalendar, store: EKEventStore) {
        self.id = calendar.calendarIdentifier
        self.name = calendar.title
        self.color = calendar.cgColor.map { "#\(String(format: "%02X%02X%02X", Int($0.components?[0] ?? 0 * 255), Int($0.components?[1] ?? 0 * 255), Int($0.components?[2] ?? 0 * 255)))" }

        let predicate = store.predicateForReminders(in: [calendar])
        var count = 0
        let semaphore = DispatchSemaphore(value: 0)

        store.fetchReminders(matching: predicate) { reminders in
            count = reminders?.count ?? 0
            semaphore.signal()
        }

        _ = semaphore.wait(timeout: .now() + 1.0)
        self.count = count
    }
}

extension ReminderModel {
    init(from reminder: EKReminder, store: EKEventStore) {
        let dateFormatter = ISO8601DateFormatter()

        self.id = reminder.calendarItemIdentifier
        self.title = reminder.title ?? ""
        self.notes = reminder.notes
        self.listId = reminder.calendar.calendarIdentifier
        self.listName = reminder.calendar.title
        self.completed = reminder.isCompleted
        self.dueDate = reminder.dueDateComponents?.date.map { dateFormatter.string(from: $0) }
        self.dueDateIncludesTime = reminder.dueDateComponents?.hour != nil
        self.priority = reminder.priority
        self.url = reminder.url?.absoluteString
        self.creationDate = reminder.creationDate.map { dateFormatter.string(from: $0) } ?? ""
        self.modificationDate = reminder.lastModifiedDate.map { dateFormatter.string(from: $0) } ?? ""
    }
}
