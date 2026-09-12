import SwiftUI

struct SignInView: View {
    @Environment(AppModel.self) private var app
    @State private var username = ""
    @State private var password = ""
    @State private var errorMessage: String?
    @State private var isBusy = false
    @FocusState private var focus: Field?
    @AppStorage(DeveloperSettings.useLocalAPIKey) private var useLocalAPI = false

    private enum Field { case username, password }

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color.accentColor, Color.accentColor.mix(with: .black, by: 0.35)],
                startPoint: .top, endPoint: .bottom)
            .ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    Text("WhereHaveIBeen")
                        .font(.largeTitle.weight(.bold))
                        .foregroundStyle(.white)
                        .padding(.top, 80)

                    VStack(spacing: 0) {
                        TextField("Username", text: $username)
                            .textContentType(.username)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .focused($focus, equals: .username)
                            .submitLabel(.next)
                            .onSubmit { focus = .password }
                            .padding(14)
                        Divider().padding(.leading, 14)
                        SecureField("Password", text: $password)
                            .textContentType(.password)
                            .focused($focus, equals: .password)
                            .submitLabel(.go)
                            .onSubmit { submit() }
                            .padding(14)
                    }
                    .background(Color(uiColor: .systemBackground), in: .rect(cornerRadius: 12))

                    if let errorMessage {
                        Label(errorMessage, systemImage: "exclamationmark.circle")
                            .font(.footnote.weight(.medium))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 12).padding(.vertical, 8)
                            .background(Color.red.opacity(0.85), in: .rect(cornerRadius: 10))
                    }

                    Button(action: submit) {
                        Group {
                            if isBusy {
                                ProgressView().tint(Color.accentColor)
                            } else {
                                Text("Log in").font(.body.weight(.semibold))
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 50)
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(Color.accentColor)
                    .background(.white, in: .rect(cornerRadius: 12))
                    .disabled(isBusy || username.isEmpty || password.isEmpty)
                    .opacity(username.isEmpty || password.isEmpty ? 0.7 : 1)

                    Link("Create an account", destination: AppModel.webAppURL)
                        .font(.body.weight(.medium))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)

                    #if DEBUG
                    Toggle("Use local API (localhost:5002)", isOn: $useLocalAPI)
                        .font(.footnote)
                        .foregroundStyle(.white.opacity(0.85))
                        .tint(.white.opacity(0.5))
                        .padding(.top, 8)
                    #endif
                }
                .padding(24)
            }
            .scrollDismissesKeyboard(.interactively)
        }
    }

    private func submit() {
        guard !isBusy, !username.isEmpty, !password.isEmpty else { return }
        isBusy = true
        errorMessage = nil
        Task {
            do {
                try await app.signIn(username: username, password: password)
            } catch {
                errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
            }
            isBusy = false
        }
    }
}
