import { Component } from "preact";
import { Chart, ChartState } from "./chart";
import { ChartData } from "./chart-model";
import { FriendLeaderboard } from "./friend-leaderboard";
import { Platform } from "./platform";
import { Sic1SteamService } from "./service";

interface Sic1UserStatsState {
    chartState: ChartState;
    data?: ChartData;
}

export class Sic1UserStats extends Component<{ promise: Promise<ChartData> }, Sic1UserStatsState> {
    constructor(props) {
        super(props);
        this.state = { chartState: ChartState.loading };
    }

    public async componentDidMount() {
        try {
            this.setState({
                chartState: ChartState.loaded,
                data: await this.props.promise,
            });
        } catch (error) {
            this.setState({ chartState: ChartState.loadFailed });
        }
    }

    public render() {
        // Calculate rank
        let count = 0;
        let worse = 0;
        if (this.state.data) {
            const histogram = this.state.data.histogram.buckets;
            const highlightedValue = this.state.data.highlightedValue;
            for (let i = 0; i < histogram.length; i++) {
                const bucket = histogram[i];
                count += bucket.count;

                if (bucket.bucketMax <= highlightedValue) {
                    worse += bucket.count;
                }
            }
        }

        const rank = Math.min(count, count - (worse - 1));

        return <>
            <p>Rank: {this.state.data ? `${rank} out of ${count}` : "(loading...)"}</p>
            <div className="charts">
                <Chart title="Completed Tasks" promise={this.props.promise} />
                {Platform.service.getFriendLeaderboardAsync
                ? <>
                    <br/>
                    <FriendLeaderboard title="Completed Tasks (Friends)" promise={Platform.service.getFriendLeaderboardAsync(Sic1SteamService.solvedCountLeaderboardName)} />
                </>
                : null
            }
            </div>
        </>;
    }
}
