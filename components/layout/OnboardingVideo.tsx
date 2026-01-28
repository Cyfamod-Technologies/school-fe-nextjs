"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { isTeacherUser } from "@/lib/roleChecks";

const STORAGE_KEY = "onboarding-video-shown";
const DISMISS_KEY = "onboarding-video-dismissed";
const DEFAULT_VIDEO = "https://www.youtube.com/embed/p0Rdc7g6wzM";
// Configure these in your environment (.env) as NEXT_PUBLIC_ONBOARDING_VIDEO_ADMIN and NEXT_PUBLIC_ONBOARDING_VIDEO_TEACHER
const VIDEO_EMBED_URL_ADMIN =
  process.env.NEXT_PUBLIC_ONBOARDING_VIDEO_ADMIN ?? DEFAULT_VIDEO;
const VIDEO_EMBED_URL_TEACHER =
  process.env.NEXT_PUBLIC_ONBOARDING_VIDEO_TEACHER ?? DEFAULT_VIDEO;

export function OnboardingVideo() {
  const { user } = useAuth();

  const isTeacher = isTeacherUser(user);

  // Pick URL based on role — admin uses ADMIN env, teachers use TEACHER env.
  const videoEmbedUrl = isTeacher
    ? VIDEO_EMBED_URL_TEACHER
    : VIDEO_EMBED_URL_ADMIN;

  const [showModal, setShowModal] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [videoStarted, setVideoStarted] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const dismissed = sessionStorage.getItem(DISMISS_KEY);
    if (dismissed) {
      setIsDismissed(true);
      return;
    }
    const hasShown = sessionStorage.getItem(STORAGE_KEY);
    if (!hasShown) {
      setShowModal(true);
      sessionStorage.setItem(STORAGE_KEY, new Date().toISOString());
    }
  }, []);

  const closeModal = () => {
    setShowModal(false);
    setVideoStarted(false);
  };

  const dismissGuide = () => {
    setShowModal(false);
    setVideoStarted(false);
    setIsDismissed(true);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(DISMISS_KEY, new Date().toISOString());
    }
  };

  const openModal = () => {
    setShowModal(true);
    setVideoStarted(false);
  };

  if (isDismissed) {
    return null;
  }

  return (
    <>
      {!showModal ? (
        <div className="floating-video-launcher">
          <button
            type="button"
            className="floating-video-launch"
            onClick={openModal}
            aria-label="Open onboarding video"
          >
            <span className="floating-video-badge">Video Guide</span>
            <i className="fas fa-play" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="floating-video-dismiss"
            aria-label="Dismiss video guide"
            onClick={dismissGuide}
          >
            &times;
          </button>
        </div>
      ) : null}

      {showModal ? (
        <div
          className="floating-video-card"
          role="dialog"
          aria-modal="true"
          onClick={closeModal}
        >
          <div
            className="floating-video-content"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="floating-video-close"
              aria-label="Close video"
              onClick={closeModal}
            >
              &times;
            </button>

            {videoStarted ? (
              <div className="embed-responsive embed-responsive-16by9">
                <iframe
                  src={`${videoEmbedUrl}?autoplay=1`}
                  title={
                    isTeacher
                      ? "Teacher onboarding video"
                      : "Admin onboarding video"
                  }
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="floating-video-thumbnail">
                <div className="floating-video-text">
                  <h3>Quick Onboarding Tour</h3>
                  <p>
                    Learn the essentials of the dashboard in under two minutes.
                  </p>
                </div>
                <button
                  type="button"
                  className="floating-video-play"
                  onClick={() => setVideoStarted(true)}
                  aria-label="Play onboarding video"
                >
                  <i className="fas fa-play" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}

      <style jsx>{`
        .floating-video-launcher {
          position: fixed;
          bottom: 24px;
          right: 24px;
          width: 64px;
          height: 64px;
          z-index: 1040;
        }

        .floating-video-launch {
          position: relative;
          width: 64px;
          height: 64px;
          border-radius: 16px;
          border: none;
          background: linear-gradient(135deg, #4076ff, #6cc5ff);
          color: #ffffff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 1.75rem;
          box-shadow: 0 8px 20px rgba(64, 118, 255, 0.35);
          cursor: pointer;
        }

        .floating-video-launch:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 28px rgba(64, 118, 255, 0.45);
        }

        .floating-video-badge {
          position: absolute;
          top: -24px;
          right: 50%;
          transform: translateX(50%);
          background: transparent;
          color: #0e030cff;
          font-weight: 700;
          font-size: 0.78rem;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          pointer-events: none;
        }

        .floating-video-card {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(4, 18, 38, 0.6);
          z-index: 1050;
          padding: 1.5rem;
        }

        .floating-video-content {
          position: relative;
          width: min(920px, 100%);
          background: #0c1b2a;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 22px 45px rgba(0, 0, 0, 0.45);
        }

        .floating-video-close {
          position: absolute;
          top: 12px;
          right: 18px;
          background: none;
          border: none;
          color: #ffffff;
          font-size: 2.25rem;
          line-height: 1;
          cursor: pointer;
          z-index: 2;
        }

        .floating-video-dismiss {
          position: absolute;
          top: -6px;
          right: -6px;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: none;
          background: rgba(12, 27, 42, 0.9);
          color: #ffffff;
          font-size: 1rem;
          line-height: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 6px 12px rgba(0, 0, 0, 0.2);
        }

        .floating-video-thumbnail {
          position: relative;
          background-image: url("/assets/img/figure/login-bg.jpg");
          background-size: cover;
          background-position: center;
          height: 260px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          color: #ffffff;
          text-align: center;
          padding: 2rem 1.5rem;
        }

        .floating-video-thumbnail::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(
            135deg,
            rgba(4, 44, 84, 0.78),
            rgba(64, 118, 255, 0.6)
          );
          z-index: 0;
        }

        .floating-video-text {
          position: relative;
          z-index: 1;
        }

        .floating-video-text h3 {
          font-size: 1.6rem;
          margin-bottom: 0.5rem;
        }

        .floating-video-text p {
          margin-bottom: 1.75rem;
          color: rgba(255, 255, 255, 0.85);
        }

        .floating-video-play {
          position: relative;
          z-index: 1;
          width: 72px;
          height: 72px;
          border-radius: 50%;
          border: none;
          background: rgba(255, 255, 255, 0.9);
          color: #0c1b2a;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 1.9rem;
          box-shadow: 0 10px 20px rgba(0, 0, 0, 0.35);
          cursor: pointer;
        }

        .floating-video-content iframe {
          width: 100%;
          height: 520px;
          border: none;
        }

        @media (max-width: 768px) {
          .floating-video-content iframe {
            height: 260px;
          }
          .floating-video-thumbnail {
            height: auto;
            padding: 1.75rem 1rem;
          }
        }
      `}</style>
    </>
  );
}
