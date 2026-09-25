import React from "react";
import { toast } from "sonner";

// Error messages must never timeout under any situation.
const origError = toast.error;
toast.error = ((
  message: Parameters<typeof origError>[0],
  data?: Parameters<typeof origError>[1]
) => {
  return origError(message, {
    closeButton: true,
    ...data,
    duration: Infinity,
  });
}) as typeof toast.error;

const origPromise = toast.promise;
toast.promise = ((promise: any, data: any) => {
  if (data && data.error !== undefined) {
    const rawError = data.error;
    const wrapResult = (res: any) => {
      if (typeof res === "object" && res !== null && !React.isValidElement(res)) {
        return { closeButton: true, ...res, duration: Infinity };
      }
      return { message: res, closeButton: true, duration: Infinity };
    };

    if (typeof rawError === "function") {
      data = {
        ...data,
        error: async (...args: any[]) => {
          const res = await rawError(...args);
          return wrapResult(res);
        },
      };
    } else {
      data = {
        ...data,
        error: wrapResult(rawError),
      };
    }
  }
  return origPromise(promise, data);
}) as typeof toast.promise;

const origMessage = toast.message;
toast.message = ((
  message: Parameters<typeof origMessage>[0],
  data?: Parameters<typeof origMessage>[1]
) => {
  if ((data as { type?: string } | undefined)?.type === "error") {
    data = { closeButton: true, ...data, duration: Infinity };
  }
  return origMessage(message, data);
}) as typeof toast.message;

const origCustom = toast.custom;
toast.custom = ((
  jsx: Parameters<typeof origCustom>[0],
  data?: Parameters<typeof origCustom>[1]
) => {
  if ((data as { type?: string } | undefined)?.type === "error") {
    data = { closeButton: true, ...data, duration: Infinity };
  }
  return origCustom(jsx, data);
}) as typeof toast.custom;

export * from "sonner";
export { toast };
