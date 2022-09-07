import * as Contract from "sic1-server-contract";
import { Shared } from "./shared";
import { ChartData } from "./chart-model";

export type LeaderboardEntry = Contract.LeaderboardEntry;

export interface Sic1Service {
    updateUserProfileAsync(userId: string, name: string): Promise<void>;
    getPuzzleStatsAsync(puzzleTitle: string, cycles: number, bytes: number): Promise<{ cycles: ChartData, bytes: ChartData }>;
    getUserStatsAsync(userId?: string): Promise<ChartData>;
    getLeaderboardAsync(): Promise<LeaderboardEntry[]>;
    uploadSolutionAsync(userId: string, puzzleTitle: string, cycles: number, bytes: number, programBytes: number[]): Promise<void>;
}

const identity = <T extends unknown>(x: T) => x;

type ParameterList<T> = {[K in keyof T]: string | number | boolean | undefined | null};

interface HistogramBounds {
    min: number;
    max: number;
    bucketSize: number;
}

export interface Sic1Service {
    updateUserProfileAsync(userId: string, name: string): Promise<void>;
    getPuzzleStatsAsync(puzzleTitle: string, cycles: number, bytes: number): Promise<{ cycles: ChartData, bytes: ChartData }>;
    getUserStatsAsync(userId: string): Promise<ChartData>;
    getLeaderboardAsync(): Promise<LeaderboardEntry[]>;
    uploadSolutionAsync(userId: string, puzzleTitle: string, cycles: number, bytes: number, programBytes: number[]): Promise<void>;
}

export class Sic1WebService implements Sic1Service {
    public static readonly userNameMaxLength = Contract.UserNameMaxLength;

    private readonly root = "https://sic1-db.netlify.app/.netlify/functions/api";
    // private readonly root = "http://localhost:8888/.netlify/functions/api"; // Local test server
    private readonly puzzleBucketCount = 20;
    private readonly userBucketCount = 30;

    private createQueryString<T>(o: ParameterList<T>): string {
        let str = "";
        let first = true;
        for (const key in o) {
            const value = o[key];
            if (value !== undefined && value !== null) {
                str += `${first ? "?" : "&"}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
                first = false;
            }
        }
        return str;
    }

    private replaceParameters<T>(path: string, o: ParameterList<T>): string {
        for (const key in o) {
            const value = o[key];
            if (value !== undefined && value !== null) {
                path = path.replace(`:${key}`, encodeURIComponent(value));
            }
        }
        return path;
    }

    private createUri<P, Q>(path: string, parameters: ParameterList<P>, query: ParameterList<Q>) {
        return this.root
            + this.replaceParameters(path, parameters)
            + this.createQueryString(query);
    }

    private calculateBounds(min: number, max: number, bucketCount: number): HistogramBounds {
        // Center the results if they're not spread out very much
        if ((max - min) < bucketCount) {
            min = Math.max(1, min - (bucketCount / 2));
        }

        return {
            min,
            max,
            bucketSize: Math.max(1, Math.ceil((max - min + 1) / bucketCount)),
        }
    }

    private sortAndNormalizeHistogramData(data: Contract.HistogramData, bucketCount: number): Contract.HistogramData {
        let min = 0;
        let max = 0;
        if (data.length > 0) {
            min = data[0].bucketMax;
            max = data[0].bucketMax;
            for (const item of data) {
                min = Math.min(min, item.bucketMax);
                max = Math.max(max, item.bucketMax);
            }
        }

        const bounds = this.calculateBounds(min, max, bucketCount);
        let buckets: Contract.HistogramDataBucket[] = [];

        // Initialize
        let bucketed: {[bucket: number]: number} = {};
        for (let i = 0; i < bucketCount; i++) {
            const bucket = bounds.min + (bounds.bucketSize * i);
            bucketed[bucket] = 0;
        }

        // Aggregate
        for (let i = 0; i < data.length; i++) {
            const bucket = Math.floor((data[i].bucketMax - bounds.min) / bounds.bucketSize) * bounds.bucketSize + bounds.min;
            bucketed[bucket] += data[i].count;
        }

        // Project
        for (const bucketMax in bucketed) {
            const count = bucketed[bucketMax];
            buckets.push({
                bucketMax: parseInt(bucketMax),
                count,
            });
        }

        return buckets;
    }

    public async updateUserProfileAsync(userId: string, name: string): Promise<void> {
        await fetch(
            this.createUri<Contract.UserProfileRequestParameters, {}>(
                Contract.UserProfileRoute,
                { userId },
                {}),
            {
                method: "PUT",
                mode: "cors",
                body: JSON.stringify(identity<Contract.UserProfilePutRequestBody>({ name })),
            }
        );
    }

    public async getPuzzleStatsAsync(puzzleTitle: string, cycles: number, bytes: number): Promise<{ cycles: ChartData, bytes: ChartData }> {
        const response = await fetch(
            this.createUri<Contract.PuzzleStatsRequestParameters, {}>(
                Contract.PuzzleStatsRoute,
                { testName: puzzleTitle },
                {}),
            {
                method: "GET",
                mode: "cors",
            }
        );

        if (response.ok) {
            const data = await response.json() as Contract.PuzzleStatsResponse;

            // Merge and normalize data
            const cyclesHistogram = this.sortAndNormalizeHistogramData(data.cyclesExecutedBySolution.concat([{ bucketMax: cycles, count: 1 }]), this.puzzleBucketCount);
            const bytesHistogram = this.sortAndNormalizeHistogramData(data.memoryBytesAccessedBySolution.concat([{ bucketMax: bytes, count: 1 }]), this.puzzleBucketCount);
            return {
                cycles: {
                    histogram: cyclesHistogram,
                    highlightedValue: cycles,
                },
                bytes: {
                    histogram: bytesHistogram,
                    highlightedValue: bytes,
                },
            };
        }

        throw new Error("Request failed");
    }

    public async getUserStatsAsync(userId?: string): Promise<ChartData> {
        const response = await fetch(
            this.createUri<{}, Contract.UserStatsRequestQuery>(
                Contract.UserStatsRoute,
                {},
                { userId },
            ),
            {
                method: "GET",
                mode: "cors",
            }
        );

        if (response.ok) {
            const data = await response.json() as Contract.UserStatsResponse;
            const solutionsHistogram = this.sortAndNormalizeHistogramData(data.solutionsByUser, this.userBucketCount);
            return {
                histogram: solutionsHistogram,
                highlightedValue: data.userSolvedCount,
            };
        }

        throw new Error("Request failed");
    }

    public async getLeaderboardAsync(): Promise<LeaderboardEntry[]> {
        const response = await fetch(
            this.createUri<{}, {}>(Contract.LeaderboardRoute, {}, {}),
            {
                method: "GET",
                mode: "cors",
            }
        );

        if (response.ok) {
            const data = await response.json() as Contract.LeaderboardReponse;
            return data;
        }

        throw new Error("Request failed");
    }

    public async uploadSolutionAsync(userId: string, puzzleTitle: string, cycles: number, bytes: number, programBytes: number[]): Promise<void> {
        const programString = programBytes.map(byte => Shared.hexifyByte(byte)).join("");
        await fetch(
            this.createUri<Contract.SolutionUploadRequestParameters, {}>(
                Contract.SolutionUploadRoute,
                { testName: puzzleTitle },
                {}),
            {
                method: "POST",
                mode: "cors",
                body: JSON.stringify(identity<Contract.SolutionUploadRequestBody>({
                    userId,
                    solutionCycles: cycles,
                    solutionBytes: bytes,
                    program: programString,
                })),
            }
        );
    }
}

export class Sic1SteamService implements Sic1Service {
    private webService: Sic1WebService;

    constructor() {
        this.webService = new Sic1WebService();
    }

    public async updateUserProfileAsync(userId: string, name: string): Promise<void> {
        // User profile updates are not supported on Steam
    }

    public getPuzzleStatsAsync(puzzleTitle: string, cycles: number, bytes: number): Promise<{ cycles: ChartData; bytes: ChartData; }> {
        return this.webService.getPuzzleStatsAsync(puzzleTitle, cycles, bytes);
    }

    public async getUserStatsAsync(userId?: string): Promise<ChartData> {
        const stats = await this.webService.getUserStatsAsync();
        
        // Note: The local solvedCount is used, so stats.highlightedValue not being set is acceptable
        return stats;
    }

    public getLeaderboardAsync(): Promise<Contract.LeaderboardEntry[]> {
        return this.webService.getLeaderboardAsync();
    }

    public async uploadSolutionAsync(userId: string, puzzleTitle: string, cycles: number, bytes: number, programBytes: number[]): Promise<void> {
        // Solutions should not be uploaded to the web service from Steam
    }
}
