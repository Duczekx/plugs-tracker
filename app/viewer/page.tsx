"use client";

import RoleLoginPage from "@/components/RoleLoginPage";

type RoleLoginPageProps = {
  searchParams?: {
    error?: string;
    next?: string;
  };
};

export default function ViewerLoginPage({ searchParams }: RoleLoginPageProps) {
  return <RoleLoginPage searchParams={searchParams} forceRole="VIEWER" />;
}
