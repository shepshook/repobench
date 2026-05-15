import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ICurationService, Candidate } from '../../../src/core/contracts';
import { OpenAICurationService } from '../../../src/core/services/curation-service';
import OpenAI from 'openai';

const mockCreate = vi.fn();

vi.mock('openai', () => {
    return {
        default: class {
            chat = {
                completions: {
                    create: mockCreate,
                },
            };
        },
    };
});

describe('OpenAICurationService', () => {
    let curationService: ICurationService;

    beforeEach(() => {
        vi.clearAllMocks();
        curationService = new OpenAICurationService();
    });

    it('should curate a candidate successfully', async () => {
        const candidate: Candidate = {
            id: '550e8400-e29b-41d4-a716-446655440000',
            hash: 'abc1234',
            message: 'feat: add new feature',
            files: ['src/index.ts'],
            status: 'pending',
            created_at: new Date(),
        };

        const mockResponse = {
            choices: [{
                message: {
                    content: JSON.stringify({
                        score: 0.9,
                        reasoning: 'Good candidate',
                        isApproved: true
                    })
                }
            }]
        };
        mockCreate.mockResolvedValue(mockResponse);

        const result = await curationService.curate(candidate);

        expect(result).toBeDefined();
        expect(result.score).toBe(0.9);
        expect(result.isApproved).toBe(true);
        expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should handle API failures and implement retry logic', async () => {
        const candidate: Candidate = {
            id: '550e8400-e29b-41d4-a716-446655440000',
            hash: 'abc1234',
            message: 'feat: add new feature',
            files: ['src/index.ts'],
            status: 'pending',
            created_at: new Date(),
        };

        mockCreate
            .mockRejectedValueOnce(new Error('API Error 1'))
            .mockRejectedValueOnce(new Error('API Error 2'))
            .mockResolvedValue({
                choices: [{
                    message: {
                        content: JSON.stringify({
                            score: 0.9,
                            reasoning: 'Good candidate',
                            isApproved: true
                        })
                    }
                }]
            });

        const result = await curationService.curate(candidate);

        expect(result.score).toBe(0.9);
        expect(mockCreate).toHaveBeenCalledTimes(3);
    });

    it('should handle malformed LLM responses gracefully and retry', async () => {
        const candidate: Candidate = {
            id: '550e8400-e29b-41d4-a716-446655440000',
            hash: 'abc1234',
            message: 'feat: add new feature',
            files: ['src/index.ts'],
            status: 'pending',
            created_at: new Date(),
        };

        mockCreate
            .mockResolvedValueOnce({
                choices: [{
                    message: {
                        content: 'invalid json'
                    }
                }]
            })
            .mockResolvedValueOnce({
                choices: [{
                    message: {
                        content: JSON.stringify({
                            score: 0.9,
                            reasoning: 'Good candidate',
                            isApproved: true
                        })
                    }
                }]
            });

        const result = await curationService.curate(candidate);

        expect(result.score).toBe(0.9);
        expect(mockCreate).toHaveBeenCalledTimes(2);
    });
});
