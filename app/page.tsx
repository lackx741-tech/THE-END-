import { OperatorDashboard } from "@/components/operator-dashboard";
import { notFound } from "next/navigation";
import { isOperatorDashboardEnabled } from "@/lib/dashboard/access";

export default function Home() {
  if (!isOperatorDashboardEnabled()) {
    notFound();
  }

  return <OperatorDashboard />;
}
