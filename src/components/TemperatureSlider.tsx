import Box from '@mui/material/Box';
import { Grid, Input, Slider } from '@mui/material';
import ThermostatIcon from '@mui/icons-material/Thermostat';

interface TemperatureSliderProps {
	temperatureValue: number;
	setTemperatureValue: (value: number | number[]) => void;
	handleTemperatureInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const MIN_TEMPERATURE = 0;
const MAX_TEMPERATURE = 2;
const TEMPERATURE_STEP = 0.1;

export default function TemperatureSlider({
	handleTemperatureInputChange,
	setTemperatureValue,
	temperatureValue,
}: TemperatureSliderProps) {
	const handleSliderChange = (_event: Event, newValue: number | number[]) => {
		setTemperatureValue(newValue);
	};

	const handleBlur = () => {
		if (Array.isArray(temperatureValue)) return;

		if (temperatureValue < MIN_TEMPERATURE) {
			setTemperatureValue(MIN_TEMPERATURE);
		} else if (temperatureValue > MAX_TEMPERATURE) {
			setTemperatureValue(MAX_TEMPERATURE);
		}
	};

	return (
		<Box sx={{ width: 350 }}>
			<Grid container spacing={2} alignItems="center">
				<Grid item>
					<ThermostatIcon />
				</Grid>
				<Grid item xs>
					<Slider
						value={temperatureValue}
						onChange={handleSliderChange}
						step={TEMPERATURE_STEP}
						min={MIN_TEMPERATURE}
						max={MAX_TEMPERATURE}
						aria-labelledby="input-slider"
					/>
				</Grid>
				<Grid item>
					<Box sx={{ p: 1, marginTop: -6 }}>
						<Input
							value={temperatureValue}
							size="small"
							onChange={handleTemperatureInputChange}
							onBlur={handleBlur}
							inputProps={{
								step: TEMPERATURE_STEP,
								min: MIN_TEMPERATURE,
								max: MAX_TEMPERATURE,
								type: 'number',
								'aria-labelledby': 'input-slider',
							}}
						/>
					</Box>
				</Grid>
			</Grid>
		</Box>
	);
}
