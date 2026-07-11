"use client";

import { createContext, useContext } from "react";

export interface Me {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: { name: string; slug: string };
  permissions: string[];
}

export const MeContext = createContext<Me | null>(null);

/** Access the signed-in admin user anywhere inside the /admin tree. */
export const useMe = () => useContext(MeContext);
