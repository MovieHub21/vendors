import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import * as api from "../services/api";
import * as authService from "../services/auth";
import { __setAuthStateForTests } from "./authStore";

vi.mock("../services/auth");
vi.mock("../services/api");
const auth = vi.mocked(authService);
const backend = vi.mocked(api);

const user = { id: "u1", email: "ama@example.com" } as never;
const signedIn = () => __setAuthStateForTests({ status: "signedIn", user });
const signedOut = () => __setAuthStateForTests({ status: "signedOut", user: null });

function Where() {
  const l = useLocation();
  return <span data-testid="where">{l.pathname + l.search}</span>;
}
const renderAt = (path: string) =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[path]}>
        <App />
        <Where />
      </MemoryRouter>
    </HelmetProvider>,
  );
const type = (label: RegExp | string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const where = () => screen.getByTestId("where").textContent;

const me = (over: Partial<api.Me> = {}): api.Me => ({
  user: { id: "u1", email: "ama@example.com" },
  profile: { full_name: "Ama Okafor", phone: null },
  store: null,
  subscription: null,
  next_step: "create_store",
  ...over,
});
const store = {
  id: "s1",
  slug: "ama-hairs",
  name: "Ama Hair Studio",
  category: "Hair & wigs",
  city: "Lagos",
  state: "Lagos",
  is_published: false,
  status: "active" as const,
};

beforeEach(() => {
  vi.resetAllMocks();
  signedOut();
});
afterEach(() => vi.useRealTimers());

describe("route guard", () => {
  it.each(["/app", "/onboarding", "/onboarding/payment"])(
    "sends signed-out visitors from %s to login, remembering where they were going",
    (path) => {
      renderAt(path);
      expect(where()).toBe(`/login?next=${encodeURIComponent(path)}`);
    },
  );

  it("waits while the session is still loading instead of bouncing the vendor to login", () => {
    __setAuthStateForTests(null);
    renderAt("/app");
    expect(screen.getByRole("status")).toHaveTextContent(/Loading/);
    expect(where()).toBe("/app");
  });
});

describe("login", () => {
  it("validates before calling the server", async () => {
    renderAt("/login");
    fireEvent.click(screen.getByRole("button", { name: /Log in/ }));
    expect(await screen.findByText(/Enter your email/)).toBeInTheDocument();
    expect(auth.signIn).not.toHaveBeenCalled();
  });

  it("shows the server's message when credentials are wrong", async () => {
    auth.signIn.mockResolvedValue({
      ok: false,
      code: "invalid_credentials",
      message: "Email or password is incorrect.",
    });
    renderAt("/login");
    type("Email", "ama@example.com");
    type("Password", "wrongpass1");
    fireEvent.click(screen.getByRole("button", { name: /Log in/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Email or password is incorrect.");
  });

  it("goes to the page the vendor was trying to reach after logging in", async () => {
    auth.signIn.mockResolvedValue({ ok: true, data: undefined });
    renderAt("/login?next=%2Fapp");
    type("Email", "ama@example.com");
    type("Password", "sellsharp2026");
    fireEvent.click(screen.getByRole("button", { name: /Log in/ }));
    await waitFor(() => expect(where()).toBe("/app"));
    expect(auth.signIn).toHaveBeenCalledWith("ama@example.com", "sellsharp2026");
  });

  it("ignores an unsafe ?next= address", async () => {
    auth.signIn.mockResolvedValue({ ok: true, data: undefined });
    renderAt("/login?next=https%3A%2F%2Fevil.example");
    type("Email", "ama@example.com");
    type("Password", "sellsharp2026");
    fireEvent.click(screen.getByRole("button", { name: /Log in/ }));
    await waitFor(() => expect(where()).toBe("/onboarding"));
  });

  it("skips the form when already signed in", () => {
    signedIn();
    backend.getMe.mockResolvedValue({ ok: true, data: me() });
    renderAt("/login");
    expect(where()).toBe("/onboarding");
  });
});

describe("signup", () => {
  const fill = (password = "sellsharp2026") => {
    type("Full name", "Ama Okafor");
    type("Email", "ama@example.com");
    type("Password", password);
    fireEvent.click(screen.getByRole("button", { name: /Create account/ }));
  };

  it("rejects weak passwords locally", async () => {
    renderAt("/signup");
    fill("short");
    expect(await screen.findByText(/at least 8 characters/i, { selector: ".field-error" })).toBeInTheDocument();
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it("asks the vendor to confirm their email when Supabase requires it", async () => {
    auth.signUp.mockResolvedValue({ ok: true, data: { needsEmailConfirmation: true } });
    renderAt("/signup");
    fill();
    expect(await screen.findByText(/ama@example.com/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Check your email");
  });

  it("continues straight to onboarding when no confirmation is needed", async () => {
    auth.signUp.mockResolvedValue({ ok: true, data: { needsEmailConfirmation: false } });
    renderAt("/signup");
    fill();
    await waitFor(() => expect(where()).toBe("/onboarding"));
  });

  it("explains when the email is already registered", async () => {
    auth.signUp.mockResolvedValue({
      ok: false,
      code: "user_already_exists",
      message: "An account with this email already exists. Try logging in instead.",
    });
    renderAt("/signup");
    fill();
    expect(await screen.findByRole("alert")).toHaveTextContent(/already exists/);
  });
});

describe("password reset", () => {
  it("never reveals whether an account exists", async () => {
    auth.requestPasswordReset.mockResolvedValue({ ok: true, data: undefined });
    renderAt("/forgot-password");
    type("Email", "nobody@example.com");
    fireEvent.click(screen.getByRole("button", { name: /Send reset link/ }));
    expect(await screen.findByText(/If an account exists/)).toBeInTheDocument();
  });

  it("tells a signed-out visitor with an expired link to request a new one", () => {
    renderAt("/reset-password");
    expect(screen.getByText(/expired or was already used/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Request a new link/ })).toHaveAttribute("href", "/forgot-password");
  });

  it("checks the two passwords match, then saves", async () => {
    signedIn();
    auth.updatePassword.mockResolvedValue({ ok: true, data: undefined });
    renderAt("/reset-password");
    type("New password", "sellsharp2026");
    type("Confirm new password", "different2026");
    fireEvent.click(screen.getByRole("button", { name: /Save new password/ }));
    expect(await screen.findByText(/don't match/)).toBeInTheDocument();
    expect(auth.updatePassword).not.toHaveBeenCalled();

    type("Confirm new password", "sellsharp2026");
    fireEvent.click(screen.getByRole("button", { name: /Save new password/ }));
    expect(await screen.findByText(/password has been updated/)).toBeInTheDocument();
  });
});

describe("onboarding: store setup", () => {
  beforeEach(() => {
    signedIn();
    backend.getMe.mockResolvedValue({ ok: true, data: me() });
  });

  const stepTo = async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderAt("/onboarding");
    await screen.findByLabelText("Business name");
  };

  it("suggests a username from the business name and checks it with the server", async () => {
    backend.checkSlug.mockResolvedValue({ ok: true, data: { slug: "ama-hair-studio", available: true } });
    await stepTo();
    type("Business name", "Ama Hair Studio");
    expect(screen.getByLabelText("Store username")).toHaveValue("ama-hair-studio");
    await act(async () => vi.advanceTimersByTime(500));
    expect(await screen.findByText(/ama-hair-studio is available/)).toBeInTheDocument();
    expect(backend.checkSlug).toHaveBeenCalledWith("ama-hair-studio");
  });

  it("blocks reserved and malformed usernames instantly, without asking the server", async () => {
    await stepTo();
    type("Store username", "admin");
    expect(await screen.findByText(/That name is reserved/)).toBeInTheDocument();
    type("Store username", "ama hairs");
    expect(await screen.findByText(/lowercase letters, numbers and single hyphens/)).toBeInTheDocument();
    await act(async () => vi.advanceTimersByTime(1000));
    expect(backend.checkSlug).not.toHaveBeenCalled();
  });

  it("shows a taken username as unavailable", async () => {
    backend.checkSlug.mockResolvedValue({ ok: true, data: { slug: "ama-hairs", available: false, reason: "taken" } });
    await stepTo();
    type("Store username", "ama-hairs");
    await act(async () => vi.advanceTimersByTime(500));
    expect(await screen.findByText(/already taken/)).toBeInTheDocument();
  });

  it("creates the store, then moves on to the subscription step", async () => {
    backend.checkSlug.mockResolvedValue({ ok: true, data: { slug: "ama-hairs", available: true } });
    backend.createStore.mockResolvedValue({ ok: true, data: { store } });
    await stepTo();
    type("Business name", "Ama Hair Studio");
    type("Store username", "ama-hairs");
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "Hair & wigs" } });
    fireEvent.change(screen.getByLabelText("State"), { target: { value: "Lagos" } });
    await act(async () => vi.advanceTimersByTime(500));
    await screen.findByText(/ama-hairs is available/);

    backend.getMe.mockResolvedValue({ ok: true, data: me({ store, next_step: "subscribe" }) });
    fireEvent.click(screen.getByRole("button", { name: /Continue/ }));

    expect(await screen.findByRole("button", { name: /Pay ₦3,000 with Paystack/ })).toBeInTheDocument();
    expect(backend.createStore).toHaveBeenCalledWith({
      name: "Ama Hair Studio",
      slug: "ama-hairs",
      category: "Hair & wigs",
      state: "Lagos",
      city: undefined,
    });
  });

  it("requires a category and state before submitting", async () => {
    await stepTo();
    type("Business name", "Ama Hair Studio");
    fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
    expect(await screen.findByText("Choose a category.")).toBeInTheDocument();
    expect(screen.getByText("Choose your state.")).toBeInTheDocument();
    expect(backend.createStore).not.toHaveBeenCalled();
  });
});

describe("onboarding: subscription and payment", () => {
  beforeEach(() => signedIn());

  it("sends the vendor to Paystack's checkout page", async () => {
    backend.getMe.mockResolvedValue({ ok: true, data: me({ store, next_step: "subscribe" }) });
    backend.startSubscription.mockResolvedValue({
      ok: true,
      data: { authorization_url: "https://checkout.paystack.com/abc", reference: "ss_sub_1" },
    });
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    renderAt("/onboarding");
    fireEvent.click(await screen.findByRole("button", { name: /Pay ₦3,000 with Paystack/ }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://checkout.paystack.com/abc"));
    vi.unstubAllGlobals();
  });

  it("skips onboarding for vendors who are already set up", async () => {
    backend.getMe.mockResolvedValue({ ok: true, data: me({ store, next_step: "done" }) });
    renderAt("/onboarding");
    await waitFor(() => expect(where()).toBe("/app"));
  });

  it("confirms the payment on the Paystack return page and shows the live store link", async () => {
    backend.verifyPayment.mockResolvedValue({ ok: true, data: { status: "success" } });
    backend.getMe.mockResolvedValue({ ok: true, data: me({ store, next_step: "done" }) });
    renderAt("/onboarding/payment?reference=ss_sub_1&trxref=ss_sub_1");
    expect(await screen.findByText(/Payment confirmed/)).toBeInTheDocument();
    expect(backend.verifyPayment).toHaveBeenCalledWith("ss_sub_1");
    expect(await screen.findByRole("link", { name: /ama-hairs/ })).toHaveAttribute("href", "/ama-hairs");
  });

  it("tells the vendor when the payment did not go through", async () => {
    backend.verifyPayment.mockResolvedValue({ ok: true, data: { status: "failed" } });
    renderAt("/onboarding/payment?reference=ss_sub_2");
    expect(await screen.findByText(/haven't been charged/)).toBeInTheDocument();
  });

  it("handles a missing reference", () => {
    renderAt("/onboarding/payment");
    expect(screen.getByRole("alert")).toHaveTextContent(/couldn't find a payment/);
    expect(backend.verifyPayment).not.toHaveBeenCalled();
  });
});

describe("dashboard", () => {
  it("shows the store link and subscription for a set-up vendor, and logs out", async () => {
    signedIn();
    backend.getMe.mockResolvedValue({
      ok: true,
      data: me({
        store: { ...store, is_published: true },
        subscription: {
          plan_code: "monthly",
          status: "active",
          current_period_end: "2026-12-11T10:00:00Z",
          active: true,
        },
        next_step: "done",
      }),
    });
    auth.signOut.mockResolvedValue();
    renderAt("/app");
    expect(await screen.findByRole("heading", { level: 1, name: "Welcome, Ama" })).toBeInTheDocument();
    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(screen.getByText(/Active until 11 December 2026/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));
    await waitFor(() => expect(auth.signOut).toHaveBeenCalled());
  });

  it("sends vendors who haven't finished setup back to onboarding", async () => {
    signedIn();
    backend.getMe.mockResolvedValue({ ok: true, data: me({ next_step: "subscribe", store }) });
    renderAt("/app");
    await waitFor(() => expect(where()).toBe("/onboarding"));
  });
});
