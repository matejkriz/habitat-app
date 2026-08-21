import { SignIn } from "@clerk/nextjs";
import Image from "next/image";
import {
  DEV_PERSONA_EMAIL,
  isDevPersonaModeAllowed,
} from "@/lib/dev-persona";

export default function LoginPage() {
  const devPersonaMode = isDevPersonaModeAllowed();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-cream px-4">
      {/* Decorative background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gold/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-sage/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <Image
            src="/habitat-logo.webp"
            alt="Habitat"
            width={308}
            height={100}
            className="h-16 w-auto mx-auto"
          />
          <p className="text-charcoal-light mt-4">Docházka</p>
        </div>

        {devPersonaMode && (
          <div className="mb-4 rounded-xl border-2 border-coral bg-[#fff8e8] p-3 shadow-[3px_3px_0_0_rgba(224,107,91,0.22)]">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-charcoal px-2 py-1 font-mono text-[10px] font-bold tracking-[0.16em] text-white">
                DEV LOGIN
              </span>
              <p className="text-xs font-bold text-charcoal">
                Přihlas se účtem {DEV_PERSONA_EMAIL}
              </p>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-charcoal-light">
              Po přihlášení můžeš v hlavičce okamžitě přepínat testovací
              rodiče, učitele a ředitele.
            </p>
          </div>
        )}

        {/* Clerk SignIn */}
        <div className="flex justify-center">
          <SignIn
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "bg-white rounded-2xl shadow-lg border-0",
                headerTitle: "text-xl font-semibold text-charcoal",
                headerSubtitle: "text-charcoal-light text-sm",
                socialButtonsBlockButton:
                  "border border-cream-dark hover:bg-cream transition-colors",
                socialButtonsBlockButtonText: "text-charcoal font-medium",
                dividerLine: "bg-cream-dark",
                dividerText: "text-charcoal-light",
                formFieldLabel: "text-charcoal font-medium",
                formFieldInput:
                  "border-cream-dark focus:border-gold focus:ring-gold rounded-lg",
                formButtonPrimary:
                  "bg-gold hover:bg-gold-dark text-white font-medium rounded-lg",
                footerActionLink: "text-gold hover:text-gold-dark",
                identityPreviewEditButton: "text-gold hover:text-gold-dark",
              },
              layout: {
                socialButtonsPlacement: "top",
                socialButtonsVariant: "blockButton",
              },
            }}
            forceRedirectUrl="/"
          />
        </div>

        <p className="text-center text-charcoal-light text-xs mt-6">
          Dětská vzdělávací skupina Habitat Zbraslav
        </p>
      </div>
    </div>
  );
}
