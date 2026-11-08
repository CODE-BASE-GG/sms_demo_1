import { GraduationCap, ShieldCheck, Sparkles, Sun } from 'lucide-react';

export default function AuthShell({ children, footer }) {
  return (
    <div className="auth-layout">
      <aside className="auth-hero">
        <div className="auth-hero-glow glow-one" />
        <div className="auth-hero-glow glow-two" />

        <div className="auth-brand">
          <span className="brand-sun">
            <Sun size={24} strokeWidth={2.4} />
          </span>
          <span>Sunny Campus</span>
        </div>

        <div className="auth-hero-copy">
          <span className="eyebrow">
            <Sparkles size={15} /> Student management, made bright
          </span>
          <h1>Keep your whole campus in one sunny place.</h1>
          <p>
            Courses, sections, teachers, scores and attendance — organised, connected and
            easy to find.
          </p>

          <div className="auth-points">
            <div className="auth-point">
              <span className="point-icon">
                <GraduationCap size={18} />
              </span>
              <div>
                <strong>Built for teachers</strong>
                <span>Record scores, attendance and class activity in seconds.</span>
              </div>
            </div>
            <div className="auth-point">
              <span className="point-icon">
                <ShieldCheck size={18} />
              </span>
              <div>
                <strong>Clear for admins</strong>
                <span>Every change is recorded in an easy-to-review audit trail.</span>
              </div>
            </div>
          </div>
        </div>

        <p className="auth-hero-foot">A little sunshine for your school day.</p>
      </aside>

      <main className="auth-panel">
        <div className="auth-panel-inner">
          <div className="auth-mobile-brand">
            <span className="brand-sun">
              <Sun size={22} strokeWidth={2.4} />
            </span>
            <span>Sunny Campus</span>
          </div>
          {children}
          {footer}
        </div>
      </main>
    </div>
  );
}
