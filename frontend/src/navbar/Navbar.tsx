import { useState } from "react";
import styles from "./Navbar.module.css";

export interface NavbarProps {
  currentPath: string;
  user: {
    isAuthenticated: boolean;
    username: string;
  };
  aboutUrl: string;
  homeUrl: string;
  topicsUrl: string;
  quizUrl: string;
  quemoreUrl: string;
  addcontentUrl: string;
  editquestionsUrl: string;
  aiGeneratorUrl: string;
  profileUrl: string;
}

interface NavLinkItem {
  label: string;
  href: string;
  active: boolean;
  id: string;
  highlight?: boolean;
}

export function Navbar({
  currentPath,
  user,
  aboutUrl,
  homeUrl,
  topicsUrl,
  quizUrl,
  quemoreUrl,
  addcontentUrl,
  editquestionsUrl,
  aiGeneratorUrl,
  profileUrl,
}: NavbarProps) {
  const [isOpen, setIsOpen] = useState(false);

  const navLinks: NavLinkItem[] = [
    { label: "About Us", href: aboutUrl, active: currentPath === aboutUrl, id: "signUp" },
    { label: "Home/Stats", href: homeUrl, active: currentPath === homeUrl, id: "home" },
    { label: "Topics", href: topicsUrl, active: currentPath === topicsUrl, id: "topics" },
  ];

  if (user.isAuthenticated) {
    navLinks.push(
      { label: "Take Quiz", href: quizUrl, active: currentPath === quizUrl, id: "quiz" },
      { label: "Que More", href: quemoreUrl, active: currentPath === quemoreUrl, id: "quemore" },
      { label: "Add Content", href: addcontentUrl, active: currentPath === addcontentUrl, id: "addcontent" },
      { label: "Edit Questions", href: editquestionsUrl, active: currentPath === editquestionsUrl, id: "editquestions" },
      { label: "AI Generator", href: aiGeneratorUrl, active: currentPath === aiGeneratorUrl, id: "ai-question-generator" },
      { label: "Profile", href: profileUrl, active: currentPath === profileUrl, id: "profile" },
      { label: `Logout (${user.username})`, href: "/logout", active: false, id: "logout", highlight: true }
    );
  } else {
    navLinks.push(
      { label: "Login", href: "/login", active: currentPath === "/login", id: "login", highlight: true }
    );
  }

  return (
    <nav className={styles.nav}>
      <div className={styles.inner}>
        {/* Logo / Brand styling */}
        <div className={styles.brandContainer}>
          <a href="/" className={styles.brandLink}>
            <span className={styles.star}>★</span>
            DoSomeReps
          </a>

        </div>

        {/* Hamburger Button for mobile */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={styles.togglerBtn}
        >
          <span
            className={`${styles.togglerBar} ${
              isOpen ? styles.togglerBarOpen1 : ""
            }`}
          />
          <span
            className={`${styles.togglerBar} ${
              isOpen ? styles.togglerBarOpen2 : ""
            }`}
          />
          <span
            className={`${styles.togglerBar} ${
              isOpen ? styles.togglerBarOpen3 : ""
            }`}
          />
        </button>

        {/* Links Container */}
        <div
          className={`${styles.linksContainer} ${
            isOpen ? styles.linksContainerShow : ""
          }`}
        >
          <div className={styles.linksInner}>
            {navLinks.map((link) => (
              <a
                key={link.id}
                id={link.id}
                href={link.href}
                className={`${styles.link} ${
                  link.active ? styles.linkActive : ""
                } ${link.highlight ? styles.linkHighlight : ""}`}
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
