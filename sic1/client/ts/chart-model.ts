import * as Contract from "sic1-server-contract";

export interface HistogramBucketDetail {
    value: number;
    count: number;
}

export type HistogramBucketWithDetails = (Contract.HistogramDataBucket & {
    details: HistogramBucketDetail[];
});

export interface HistogramDetail {
    buckets: HistogramBucketWithDetails[];
    outliers?: HistogramBucketDetail[];
}

export interface ChartData {
    histogram: HistogramDetail;
    highlightedValue?: number;
}
