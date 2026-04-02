"use client";
import { usePathname } from "next/navigation";
import Sidebar, { type SidebarItem } from "./Sidebar";

interface SidebarWrapperProps {
  lexicon: string;
  items: SidebarItem[];
}

export default function SidebarWrapper({ lexicon, items }: SidebarWrapperProps) {
  const currentPath = usePathname();
  return <Sidebar lexicon={lexicon} items={items} currentPath={currentPath} />;
}
