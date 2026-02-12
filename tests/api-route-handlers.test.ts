import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { NextRequest } from "next/server";

import {
  GET as fetchSubjects,
} from "../app/api/subjects/route";
import {
  GET as fetchCurricula,
} from "../app/api/curricula/route";
import {
  subjectsRouteDependencies,
  curriculaRouteDependencies,
} from "../lib/api-route-deps";

const defaultSubjectDependencies = { ...subjectsRouteDependencies };
const defaultCurriculaDependencies = { ...curriculaRouteDependencies };

type SubjectSessionResult = Awaited<ReturnType<typeof subjectsRouteDependencies.getServerSession>>;
type SubjectScopeResult = Awaited<ReturnType<
  typeof subjectsRouteDependencies.resolveParentChildScopeForRequest
>>;
type CurriculaSessionResult = Awaited<ReturnType<typeof curriculaRouteDependencies.getServerSession>>;
type CurriculaScopeResult = Awaited<ReturnType<
  typeof curriculaRouteDependencies.resolveParentChildScopeForRequest
>>;

const stubSubjectSession = (value: SubjectSessionResult | null) => {
  subjectsRouteDependencies.getServerSession = (async () => value) as typeof subjectsRouteDependencies.getServerSession;
};

const stubSubjectScope = (value: SubjectScopeResult) => {
  subjectsRouteDependencies.resolveParentChildScopeForRequest = (
    async (..._args: Parameters<typeof subjectsRouteDependencies.resolveParentChildScopeForRequest>) => value
  ) as typeof subjectsRouteDependencies.resolveParentChildScopeForRequest;
};

const stubCurriculaSession = (value: CurriculaSessionResult | null) => {
  curriculaRouteDependencies.getServerSession = (async () => value) as typeof curriculaRouteDependencies.getServerSession;
};

const stubCurriculaScope = (value: CurriculaScopeResult) => {
  curriculaRouteDependencies.resolveParentChildScopeForRequest = (
    async (..._args: Parameters<typeof curriculaRouteDependencies.resolveParentChildScopeForRequest>) => value
  ) as typeof curriculaRouteDependencies.resolveParentChildScopeForRequest;
};

const stubCurriculaFetcher = (
  value: Awaited<ReturnType<typeof curriculaRouteDependencies.getCurriculaForSubject>>,
) => {
  curriculaRouteDependencies.getCurriculaForSubject = (
    (..._args: Parameters<typeof curriculaRouteDependencies.getCurriculaForSubject>) => Promise.resolve(value)
  ) as typeof curriculaRouteDependencies.getCurriculaForSubject;
};

const makeSubjectSession = (user: { id: string; role: string }) => ({ user } as SubjectSessionResult);
const makeCurriculaSession = (user: { id: string; role: string }) => ({ user } as CurriculaSessionResult);

beforeEach(() => {
  Object.assign(subjectsRouteDependencies, defaultSubjectDependencies);
  Object.assign(curriculaRouteDependencies, defaultCurriculaDependencies);
});

const buildRequest = (pathname: string, params?: Record<string, string>) => {
  const url = new URL(`http://localhost${pathname}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  }
  return new NextRequest(url);
};

describe("api subjects route", () => {
  it("returns 401 when the session is missing", async () => {
    stubSubjectSession(null);

    const response = await fetchSubjects(buildRequest("/api/subjects"));
    assert.strictEqual(response.status, 401);
    assert.deepStrictEqual(await response.json(), { error: "Unauthorized" });
  });

  it("returns 403 when child scope is missing", async () => {
    stubSubjectSession(makeSubjectSession({ id: "kid", role: "kid" }));
    stubSubjectScope({ childId: null, error: "missing_child_scope" });

    const response = await fetchSubjects(buildRequest("/api/subjects"));
    assert.strictEqual(response.status, 403);
    assert.deepStrictEqual(await response.json(), { error: "Missing child scope" });
  });

  it("returns 403 when scope is forbidden", async () => {
    stubSubjectSession(makeSubjectSession({ id: "parent", role: "parent" }));
    stubSubjectScope({ childId: null, error: "forbidden" });

    const response = await fetchSubjects(buildRequest("/api/subjects", { childId: "child" }));
    assert.strictEqual(response.status, 403);
    assert.deepStrictEqual(await response.json(), { error: "Forbidden" });
  });

  it("returns subjects when authorized", async () => {
    const payload = [{ id: "subject-1", name: "History" }];
    stubSubjectSession(makeSubjectSession({ id: "admin", role: "admin" }));
    stubSubjectScope({ childId: null });
    subjectsRouteDependencies.getAllSubjects = (async () => payload) as typeof subjectsRouteDependencies.getAllSubjects;

    const response = await fetchSubjects(buildRequest("/api/subjects"));
    assert.strictEqual(response.status, 200);
    assert.deepStrictEqual(await response.json(), { subjects: payload });
  });
});

describe("api curricula route", () => {
  it("returns 401 when the session is missing", async () => {
    stubCurriculaSession(null);

    const response = await fetchCurricula(buildRequest("/api/curricula", { subjectId: "subject" }));
    assert.strictEqual(response.status, 401);
    assert.deepStrictEqual(await response.json(), { error: "Unauthorized" });
  });

  it("returns 403 when a kid is missing a child scope", async () => {
    stubCurriculaSession(makeCurriculaSession({ id: "kid", role: "kid" }));
    stubCurriculaScope({ childId: null, error: "missing_child_scope" });

    const response = await fetchCurricula(buildRequest("/api/curricula", { subjectId: "subject" }));
    assert.strictEqual(response.status, 403);
    assert.deepStrictEqual(await response.json(), { error: "Missing child scope" });
  });

  it("returns curricula when authorized", async () => {
    const payload = [{ id: "curriculum-1", title: "Algebra" }];
    stubCurriculaSession(makeCurriculaSession({ id: "admin", role: "admin" }));
    stubCurriculaScope({ childId: null });
    stubCurriculaFetcher(payload);

    const response = await fetchCurricula(buildRequest("/api/curricula", { subjectId: "subject" }));
    assert.strictEqual(response.status, 200);
    assert.deepStrictEqual(await response.json(), { curricula: payload });
  });
});
