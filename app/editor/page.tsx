"use client";

import RoleLoginPage from "@/components/RoleLoginPage";

type RoleLoginPageProps = {
  searchParams?: {
    error?: string;
    next?: string;
  };
};

export default function EditorLoginPage({ searchParams }: RoleLoginPageProps) {
  return <RoleLoginPage searchParams={searchParams} forceRole="EDITOR" />;
}
