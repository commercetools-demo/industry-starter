/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { z } from 'zod';
import { describeProblem, MAX_LIST_NAME, MAX_TEXT, validateIntake } from './validation';

const FIELD = { NothingToSubmit: 'files', InvalidOutputType: 'outputType', MissingListName: 'listName', TooManyFiles: 'files', UnsupportedFile: 'files', FileTooLarge: 'files' } as const;

/** The submit body (multipart: `outputType`, `listName`, `text`, and up to 3 `files`). The same rules as the form (validateIntake). */
export const submitIntakeSchema = z.object({
  outputType: z.string(),
  listName: z.string().max(MAX_LIST_NAME).optional(),
  text: z.string().max(MAX_TEXT).optional(),
  files: z.array(z.instanceof(File)),
}).superRefine((value, ctx) => {
  const problem = validateIntake({ ...value, files: value.files.map((f) => ({ name: f.name, size: f.size })) });
  if (problem) ctx.addIssue({ code: 'custom', path: [FIELD[problem.code]], message: describeProblem(problem) });
});
