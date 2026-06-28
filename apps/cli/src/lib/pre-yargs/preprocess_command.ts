import { passthrough } from './passthrough';

export function getYargsInput(): string[] {
  passthrough(process.argv);
  return process.argv.slice(2);
}
