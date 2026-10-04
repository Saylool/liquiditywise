/*
 * Where the code that serves this site can be read, and under what licence.
 *
 * The same repository the server is set up from (deploy/setup.sh clones it),
 * so a page that sends a reader to "the code" sends them to the code that is
 * running, not to a copy of it. A test holds the two addresses together and
 * the licence to the LICENSE file at the root.
 */

export const REPOSITORY_URL = "https://github.com/Saylool/liquiditywise";

/** The LICENSE file, as the repository shows it. */
export const LICENSE_URL = `${REPOSITORY_URL}/blob/main/LICENSE`;

/** The licence's name, as the LICENSE file's first line gives it. */
export const LICENSE_NAME = "MIT";
