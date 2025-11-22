import Foundation

// MARK: - Main Entry Point

@main
struct RemindersCLI {
    static func main() async {
        let manager = RemindersManager()
        let encoder = JSONEncoder()
        let decoder = JSONDecoder()

        // Request access on startup
        do {
            try await manager.requestAccess()
        } catch {
            sendError(code: "PERMISSION_DENIED", message: error.localizedDescription)
            return
        }

        // Read commands from stdin
        while let line = readLine() {
            guard let data = line.data(using: .utf8) else {
                sendError(code: "INVALID_INPUT", message: "Failed to read input")
                continue
            }

            do {
                let command = try decoder.decode(Command.self, from: data)
                try await handleCommand(command: command, manager: manager, encoder: encoder)
            } catch {
                sendError(code: "PARSE_ERROR", message: "Failed to parse command: \(error.localizedDescription)")
            }
        }
    }

    static func handleCommand(command: Command, manager: RemindersManager, encoder: JSONEncoder) async throws {
        let params = command.params?.mapValues { $0.value } ?? [:]

        do {
            switch command.action {
            case "list_reminder_lists":
                let lists = try manager.listReminderLists()
                sendSuccess(data: lists, encoder: encoder)

            case "create_reminder_list":
                let list = try manager.createReminderList(
                    name: params["name"] as? String ?? "",
                    color: params["color"] as? String
                )
                sendSuccess(data: list, encoder: encoder)

            case "list_reminders":
                let reminders = try manager.listReminders(params: params)
                sendSuccess(data: reminders, encoder: encoder)

            case "create_reminder":
                let reminder = try manager.createReminder(params: params)
                sendSuccess(data: reminder, encoder: encoder)

            case "update_reminder":
                let reminder = try manager.updateReminder(params: params)
                sendSuccess(data: reminder, encoder: encoder)

            case "complete_reminder":
                let reminder = try manager.completeReminder(params: params)
                sendSuccess(data: reminder, encoder: encoder)

            case "delete_reminder":
                let success = try manager.deleteReminder(params: params)
                sendSuccess(data: ["deleted": success], encoder: encoder)

            default:
                throw RemindersError.unknownAction(command.action)
            }
        } catch let error as RemindersError {
            sendError(code: error.code, message: error.localizedDescription)
        } catch {
            sendError(code: "UNKNOWN_ERROR", message: error.localizedDescription)
        }
    }

    static func sendSuccess<T: Codable>(data: T, encoder: JSONEncoder) {
        let response = Response(success: true, data: data, error: nil)
        if let jsonData = try? encoder.encode(response),
           let jsonString = String(data: jsonData, encoding: .utf8) {
            print(jsonString)
            fflush(stdout)
        }
    }

    static func sendError(code: String, message: String) {
        let response = Response<String>(
            success: false,
            data: nil,
            error: ErrorInfo(code: code, message: message)
        )
        let encoder = JSONEncoder()
        if let jsonData = try? encoder.encode(response),
           let jsonString = String(data: jsonData, encoding: .utf8) {
            print(jsonString)
            fflush(stdout)
        }
    }
}
