import ky, { AfterResponseHook, BeforeRequestHook } from "ky";

import { refreshTokens } from "@/auth/services/refreshTokens";
import { clearUniversalSession } from "@/auth/utils/clearUniversalSession";
import getUniversalSession from "@/auth/utils/getUniversalSession";
import setUniversalSession from "@/auth/utils/setUniversalSession";
import { delay } from "@/utils/Delay";

const refreshTokenResult: { isLoading: boolean; accessToken: string | null } = {
  isLoading: false,
  accessToken: null,
};

const AUTH_ENDPOINTS = [
  "authentication/register",
  "authentication/login",
  "authentication/login-phone",
  "authentication/verify",
  "authentication/refresh-tokens",
];

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken } = getUniversalSession();

  if (!refreshToken) {
    return null;
  }

  if (!refreshTokenResult.isLoading) {
    try {
      refreshTokenResult.isLoading = true;

      const response = await refreshTokens({ refreshToken });
      setUniversalSession(response);

      refreshTokenResult.accessToken = response.accessToken;
      return response.accessToken;
    } catch (error) {
      clearUniversalSession();
      return null;
    } finally {
      refreshTokenResult.isLoading = false;
    }
  } else {
    console.info("Waiting...");
    while (refreshTokenResult.isLoading) {
      await delay(Math.random() * 100 + 100);
    }

    return refreshTokenResult.accessToken;
  }
}

const beforeRequestHook: BeforeRequestHook = async (request) => {
  const { accessToken } = getUniversalSession();

  if (accessToken) {
    request.headers.set("Authorization", `Bearer ${accessToken}`);
  }
};

const afterResponseHook: AfterResponseHook = async (
  request,
  options,
  response,
) => {
  if (
    response.status === 401 &&
    AUTH_ENDPOINTS.every((x) => !request.url.endsWith(x))
  ) {
    const newAccessToken = await refreshAccessToken();
    if (newAccessToken) {
      request.headers.set("Authorization", `Bearer ${newAccessToken}`);
      return ky(request, options);
    }
  }
};

function getKy(baseURL?: string): typeof ky {
  return ky.create({
    prefixUrl: baseURL ?? "",
    timeout: 30000,
    hooks: {
      beforeRequest: [beforeRequestHook],
      afterResponse: [afterResponseHook],
    },
  });
}

export { getKy };
