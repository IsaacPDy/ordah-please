import { acceptInvitation } from "../src/features/access/accept-invitation";

describe("acceptInvitation", () => {
  it("sends the Better Auth cookie and public invitation token to the trusted API", async () => {
    const request = jest.fn((_url: string, _init: RequestInit) =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            data: { groupId: "group-1", role: "member" },
            ok: true,
          }),
          { status: 200 },
        ),
      ),
    );

    await expect(
      acceptInvitation(
        {
          apiBaseUrl: "https://preview.ordah-please.test",
          publicToken: "public-token",
          sessionCookie: "ordah-please.session_token=opaque",
        },
        request,
      ),
    ).resolves.toEqual({ groupId: "group-1", role: "member" });

    const call = request.mock.calls[0];
    expect(call?.[0]).toBe(
      "https://preview.ordah-please.test/api/access/invitations/accept",
    );
    expect(call?.[1].body).toBe(JSON.stringify({ token: "public-token" }));
    expect(call?.[1].method).toBe("POST");
    const headers = new Headers(call?.[1].headers);
    expect(headers.get("cookie")).toBe("ordah-please.session_token=opaque");
    expect(headers.get("authorization")).toBeNull();
    expect(headers.get("content-type")).toBe("application/json");
  });
});
