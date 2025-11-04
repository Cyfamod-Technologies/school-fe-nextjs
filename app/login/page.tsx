"use client";

import Link from "next/link";
import Image, { type ImageLoader } from "next/image";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoginForm } from "./login-form";

const passthroughLoader: ImageLoader = ({ src }) => src;

export default function LoginPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const searchParamsString = searchParams?.toString() ?? "";
  const registrationSuccess =
    searchParams?.get("status") === "registration-success";

  useEffect(() => {
    if (!registrationSuccess) {
      return;
    }
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParamsString);
      params.delete("status");
      const query = params.toString();
      router.replace(query ? `/login?${query}` : "/login");
    }, 6000);
    return () => clearTimeout(timer);
  }, [registrationSuccess, router, searchParamsString]);

  return (
    <>
      <div className="login-page-wrap">
        <div className="login-page-content">

          <div className="sign-up-cta mb-4 p-3 d-flex align-items-center justify-content-between flex-wrap">
            <div className="d-flex align-items-center">
              <span className="sign-up-icon d-inline-flex align-items-center justify-content-center mr-3">
                <i className="fas fa-user-plus" aria-hidden="true" />
              </span>
              <div>
                <div className="font-weight-bold mb-1">
                  First time here?
                </div>
                <small className="text-muted">
                  Create a school account in a few simple steps.
                </small>
              </div>
            </div>
            <Link href="/register" className="cta-action">
              Create an Account
            </Link>
          </div>
          <div className="login-box">
           {registrationSuccess ? (
            <div
              className="alert alert-success registration-success-alert"
              role="alert"
            >
              School Registered successfully! 
            </div>
          ) : null}
            <div className="item-logo">
              <Image
                src="/assets/img/logo2.png"
                alt="logo"
                width={160}
                height={60}
                unoptimized
                loader={passthroughLoader}
                style={{ width: "auto", height: "auto" }}
              />
            </div>
            <Suspense fallback={<div className="text-center py-4">Loading…</div>}>
              <LoginForm />
            </Suspense>
          </div>
          <p className="signup-footer text-center mt-4 small">
            Need an account for your school?{" "}
            <Link href="/register" className="signup-footer-link">
              Start the registration.
            </Link>
          </p>
        </div>
      </div>
      <style jsx>{styles}</style>
    </>
  );
}

const styles = `
.login-page-content .sign-up-cta {
  background: linear-gradient(135deg, #ff7b54 0%, #ffb26b 100%);
  border-radius: 18px;
  color: #ffffff;
  gap: 1rem;
  box-shadow: 0 18px 40px rgba(255, 123, 84, 0.3);
}

.login-page-content .sign-up-cta .sign-up-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  color: #ffffff;
  font-size: 1.35rem;
}

.login-page-content .sign-up-cta .font-weight-bold {
  color: #ffffff;
}

.login-page-content .sign-up-cta small {
  color: rgba(255, 255, 255, 0.9) !important;
}

.login-page-content .sign-up-cta .cta-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.7rem 1.75rem;
  border-radius: 999px !important;
  background: #ffffff;
  color: #ff7b54;
  border: none;
  font-weight: 700;
  font-size: 1rem;
  text-decoration: none;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.12);
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease, color 0.2s ease;
}

.login-page-content .sign-up-cta .cta-action:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 32px rgba(0, 0, 0, 0.2);
  background: rgba(255, 255, 255, 0.92);
}

.login-page-content .signup-footer {
  color: #1b2b3b !important;
  font-weight: 600;
}

.login-page-content .signup-footer .signup-footer-link {
  color: #ff7b54;
  font-weight: 700;
  text-decoration: none;
  border-bottom: 2px solid rgba(255, 123, 84, 0.4);
  padding-bottom: 0.15rem;
  transition: color 0.2s ease, border-color 0.2s ease;
}

.login-page-content .signup-footer .signup-footer-link:hover {
  color: #f95c2f;
  border-color: rgba(249, 92, 47, 0.7);
}

.registration-success-alert {
  border-radius: 16px;
  background: rgba(155, 136, 30, 0.12);
  border: 1px solid rgba(167, 40, 150, 0.3);
  color: #eb1414ff;
  font-weight: 600;
}
`;
