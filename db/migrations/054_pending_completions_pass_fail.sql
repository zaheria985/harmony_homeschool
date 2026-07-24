-- Kid-submitted completions on pass/fail courses lost their result: the queue
-- had nowhere to put it, so approval wrote a completion with neither a grade
-- nor a pass_fail and the transcript showed the course as ungraded.
ALTER TABLE pending_completions
  ADD COLUMN IF NOT EXISTS pass_fail TEXT CHECK (pass_fail IN ('pass', 'fail'));
