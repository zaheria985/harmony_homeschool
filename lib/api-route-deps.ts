import { getServerSession } from "next-auth";
import { resolveChildScopeForRequest, resolveParentChildScopeForRequest } from "@/lib/auth-scope";
import { getSubjectsForChild, getCurriculaForSubject, getCurriculaForSubjectForChild } from "@/lib/queries/calendar";
import { getAllSubjects } from "@/lib/queries/subjects";

export const subjectsRouteDependencies = {
  getServerSession,
  getSubjectsForChild,
  getAllSubjects,
  resolveChildScopeForRequest,
  resolveParentChildScopeForRequest,
};

export const curriculaRouteDependencies = {
  getServerSession,
  getCurriculaForSubject,
  getCurriculaForSubjectForChild,
  resolveChildScopeForRequest,
  resolveParentChildScopeForRequest,
};
