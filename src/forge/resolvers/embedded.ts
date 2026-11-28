import Resolver from '@forge/resolver';
import { embeddedRequest } from '../jsm-context/boundary';
// Dedicated issue-context resolver exposes only a read, without client selectors.
const resolver = new Resolver();
resolver.define('embeddedIncident', ({ context, payload }) =>
  embeddedRequest(context, payload),
);
export const embeddedHandler = resolver.getDefinitions();
