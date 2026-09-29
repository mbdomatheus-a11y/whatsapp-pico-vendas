"use client";
import { useEffect } from "react";
export function MaintenanceRunner() { useEffect(() => { void fetch("/api/maintenance/cleanup", { method: "POST" }); }, []); return null; }
