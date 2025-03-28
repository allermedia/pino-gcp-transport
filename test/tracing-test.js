import { attachTraceIdHandler, getLogTrace, getSpanId, getTraceId } from '../src/tracing.js';

describe('tracing', () => {
  it('getTraceId returns trace id', async () => {
    await attachTraceIdHandler(() => {
      expect(getTraceId()).to.equal('abc-123');
    }, 'abc-123');
  });

  it('getSpanId returns span id', async () => {
    await attachTraceIdHandler(
      () => {
        expect(getSpanId()).to.equal('span-1');
      },
      'abc-123',
      'span-1'
    );
  });

  it('getTraceId without async context returns nothing', () => {
    expect(getTraceId()).to.be.undefined;
  });

  it('getSpanId without async context returns nothing ', () => {
    expect(getSpanId()).to.be.undefined;
  });

  it('attachTraceIdHandler with throwing handler throws', async () => {
    try {
      await attachTraceIdHandler(
        () => {
          throw new Error('expected');
        },
        'abc-123',
        'span-1'
      );
    } catch (err) {
      // eslint-disable-next-line no-var
      var error = err;
    }

    expect(error).to.match(/expected/);
  });

  it('attachTraceIdHandler with falsy trace id a generated one', async () => {
    await attachTraceIdHandler(
      () => {
        const traceId = getTraceId();
        expect(getTraceId()).to.match(/^[0-9a-f]{32}$/);
        expect(getTraceId()).to.equal(traceId);
      },
      false,
      'span-1'
    );
  });

  it('getLogTrace without project id returns nothing', () => {
    expect(getLogTrace()).to.be.undefined;
    expect(getLogTrace({})).to.be.undefined;
  });

  it('getLogTrace outside a async trace context nothing', () => {
    expect(getLogTrace('aller-project-id')).to.be.undefined;
  });
});
