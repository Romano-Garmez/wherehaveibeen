import SwiftUI

enum RangeChoice: Hashable, Identifiable {
    case preset(RangePreset)
    case custom

    static let allCases: [RangeChoice] = RangePreset.allCases.map(RangeChoice.preset) + [.custom]

    var id: String {
        switch self {
        case .preset(let preset): preset.rawValue
        case .custom: "custom"
        }
    }

    var title: String {
        switch self {
        case .preset(.all): "All"
        case .preset(let preset): preset.title
        case .custom: "Custom"
        }
    }

    init(_ range: DateRangeSelection) {
        switch range {
        case .preset(let preset): self = .preset(preset)
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
            _customFrom = State(initialValue: Calendar.current.date(byAdding: .day, value: -1, to: .now) ?? .now)
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
                        DatePicker("Starts", selection: $customFrom, in: ...customTo, displayedComponents: [.date, .hourAndMinute])
                        DatePicker("Ends", selection: $customTo, in: customFrom...Date.now, displayedComponents: [.date, .hourAndMinute])
                    }
                } header: {
                    Text("Data")
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
        switch rangeChoice {
        case .preset(let preset):
            range = .preset(preset)
        case .custom:
            range = .custom(from: customFrom, to: min(customTo, .now))
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
