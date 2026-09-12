import SwiftUI

enum RangeChoice: String, CaseIterable, Identifiable {
    case week, month, year, all, custom

    var id: String { rawValue }

    var title: String {
        switch self {
        case .week: "Week"
        case .month: "Month"
        case .year: "Year"
        case .all: "All"
        case .custom: "Custom"
        }
    }

    var preset: RangePreset? {
        switch self {
        case .week: .week
        case .month: .month
        case .year: .year
        case .all: .all
        case .custom: nil
        }
    }

    init(_ range: DateRangeSelection) {
        switch range {
        case .preset(.week): self = .week
        case .preset(.month): self = .month
        case .preset(.year): self = .year
        case .preset(.all): self = .all
        case .custom: self = .custom
        }
    }
}

struct ConfigureSheet: View {
    @Bindable var model: MapScreenModel
    var devices: [String]
    @Environment(\.dismiss) private var dismiss
    @State private var rangeChoice: RangeChoice
    @State private var customFrom: Date
    @State private var customTo: Date

    init(model: MapScreenModel, devices: [String]) {
        self.model = model
        self.devices = devices
        let range = model.configuration.range
        _rangeChoice = State(initialValue: RangeChoice(range))
        if case .custom(let from, let to) = range {
            _customFrom = State(initialValue: from)
            _customTo = State(initialValue: to)
        } else {
            _customFrom = State(initialValue: Calendar.current.date(byAdding: .month, value: -1, to: .now) ?? .now)
            _customTo = State(initialValue: .now)
        }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    if devices.count > 1 {
                        Picker("Device", selection: $model.configuration.device) {
                            Text("All devices").tag(String?.none)
                            ForEach(devices, id: \.self) { device in
                                Text(device).tag(Optional(device))
                            }
                        }
                    }
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Time frame")
                        Picker("Time frame", selection: $rangeChoice) {
                            ForEach(RangeChoice.allCases) { choice in
                                Text(choice.title).tag(choice)
                            }
                        }
                        .pickerStyle(.segmented)
                        .labelsHidden()
                    }
                    if rangeChoice == .custom {
                        DatePicker("Starts", selection: $customFrom, in: ...customTo, displayedComponents: .date)
                        DatePicker("Ends", selection: $customTo, in: customFrom...Date.now, displayedComponents: .date)
                    }
                } header: {
                    Text("Data")
                } footer: {
                    Text("Times shown in your local timezone.")
                }

                Section {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("View mode")
                        Picker("View mode", selection: $model.configuration.mode) {
                            ForEach(MapMode.allCases, id: \.self) { mode in
                                Label(mode.title, systemImage: mode.symbol).tag(mode)
                            }
                        }
                        .pickerStyle(.segmented)
                        .labelsHidden()
                    }
                    Toggle("Show plane flights", isOn: $model.configuration.flightsShown)
                        .disabled(model.configuration.mode == .heatmap)
                    BufferStepper(bufferM: $model.configuration.bufferM)
                } header: {
                    Text("Map")
                } footer: {
                    Text("Segments faster than 200 mph aren't roads, so they're kept out of driven roads and out of your distance and area totals. A larger buffer takes longer and clears your routes cache.")
                }
            }
            .navigationTitle("Configure")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .onChange(of: rangeChoice) { applyRange() }
        .onChange(of: customFrom) { applyRange() }
        .onChange(of: customTo) { applyRange() }
    }

    private func applyRange() {
        let range: DateRangeSelection
        if let preset = rangeChoice.preset {
            range = .preset(preset)
        } else {
            let calendar = Calendar.current
            let start = calendar.startOfDay(for: customFrom)
            let end = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: customTo)) ?? customTo
            range = .custom(from: start, to: min(end, .now))
        }
        if model.configuration.range != range {
            model.configuration.range = range
        }
    }
}

struct BufferStepper: View {
    @Binding var bufferM: Int
    /// 0.1 mi in metres.
    private let stepM = 161

    var body: some View {
        Stepper {
            HStack {
                Text("Buffer size")
                Spacer()
                Text(StatFormatter.bufferMiles(bufferM))
                    .foregroundStyle(.secondary)
            }
        } onIncrement: {
            bufferM = min(MapConfiguration.bufferRangeM.upperBound, bufferM + stepM)
        } onDecrement: {
            bufferM = max(MapConfiguration.bufferRangeM.lowerBound, bufferM - stepM)
        }
    }
}
