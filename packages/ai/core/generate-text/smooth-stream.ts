import { delay as originalDelay } from '../../util/delay';
import { CoreTool } from '../tool/tool';
import { TextStreamPart } from './stream-text-result';

/**
 * Smooths text streaming output.
 *
 * @param delayInMs - The delay in milliseconds between each chunk. Defaults to 10ms.
 * @param chunking - Controls how the text is chunked for streaming. Use "word" to stream word by word (default), or "line" to stream line by line.
 *
 * @returns A transform stream that smooths text streaming output.
 */
export function smoothStream<TOOLS extends Record<string, CoreTool>>({
  delayInMs = 10,
  chunking = 'word',
  _internal: { delay = originalDelay } = {},
}: {
  delayInMs?: number;
  chunking?: 'word' | 'line';
  /**
   * Internal. For test use only. May change without notice.
   */
  _internal?: {
    delay?: (delayInMs: number) => Promise<void>;
  };
} = {}): (options: {
  tools: TOOLS;
}) => TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>> {
  let buffer = '';

  return () =>
    new TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>>({
      async transform(chunk, controller) {
        if (chunk.type === 'step-finish') {
          if (buffer.length > 0) {
            controller.enqueue({ type: 'text-delta', textDelta: buffer });
            buffer = '';
          }

          controller.enqueue(chunk);
          return;
        }

        if (chunk.type !== 'text-delta') {
          controller.enqueue(chunk);
          return;
        }

        buffer += chunk.textDelta;

        const regexp =
          chunking === 'line'
            ? /[^\n]*\n/m // Match full lines ending with newline
            : /\s*\S+\s+/m; // Match words with whitespace

        while (regexp.test(buffer)) {
          const chunk = buffer.match(regexp)![0];
          controller.enqueue({ type: 'text-delta', textDelta: chunk });
          buffer = buffer.slice(chunk.length);

          if (delayInMs > 0) {
            await delay(delayInMs);
          }
        }
      },
    });
}
